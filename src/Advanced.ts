// TODO: remove and replace with dependency injection instead.
import * as Results from "ts-results";
import * as Helpers from "./Helpers.js";
import { Err, Ok, Result } from "ts-results";
import * as immutable from "immutable";

////////////////////////////////////////////////////////////////////////////////
// Parser Internals
////////////////////////////////////////////////////////////////////////////////

// Located

/**
 * No parser ever uses the `CTX` it is only used as a return value in our parser.
 * A parser never knows what context they are in, infact they can't even look it up, so
 * it is safe for us to create unions between CTX and CTX as seen in {@link map2}.
 */
type Located = {
  row: number;
  col: number;
  context: unknown;
};

// State

/**
 *
 * @privateRemarks
 * TODO: Can you make it polymorphic over the `src` type?
 * Then you might be able to write parsers for bytestrings and other stringlike
 * objects
 */
type State = {
  src: string;
  offset: number; //in BYTES
  indent: number;
  context: immutable.Stack<Located>;
  row: number; //in newlines
  col: number; //in UTF-16 characters
};

// PROBLEMS

/**
 * When we reach a deadend we return all the information you need to create great
 * error messages.
 *
 * @remarks
 *
 * Say you are parsing a function named `viewHealthData` that contains a list.
 * You might get a `DeadEnd` like this:
 *
 * @example
 * ```ts
 * { row : 18
 * , col : 22
 * , problem : UnexpectedComma
 * , contextStack :
 *     [ { row : 14
 *       , col : 1
 *       , context : definition("viewHealthData")
 *      }
 *     , { row : 15
 *       , col : 4
 *       , context : list
 *       }
 *     ]
 * }
 * ```
 *
 * We have a ton of information here! So in the error message, we can say that “I
 * ran into an issue when parsing a list in the definition of `viewHealthData`. It
 * looks like there is an extra comma.” Or maybe something even better!
 *
 * Furthermore, many parsers just put a mark where the problem manifested. By
 * tracking the `row` and `col` of the context, we can show a much larger region
 * as a way of indicating “I thought I was parsing this thing that starts over
 * here.” Otherwise you can get very confusing error messages on a missing `]` or
 * `}` or `)` because “I need more indentation” on something unrelated.
 *
 * **Note:** Rows and columns are counted like a text editor. The beginning is `row=1`
 * and `col=1`. The `col` increments as characters are chomped. When a `\n` is chomped,
 * `row` is incremented and `col` starts over again at `1`.
 *
 *
 * @typeParam CTX - Extra information about the problem
 * @typeParam PROBLEM - What caused the parser to fail
 *
 * @category Parsers
 * @category DeadEnd (All)
 */
export type DeadEnd<PROBLEM> = {
  row: number;
  col: number;
  problem: PROBLEM;
  contextStack: immutable.Stack<{ row: number; col: number; context: unknown }>;
};

/**
 * @category DeadEnd (All)
 */
export function Deadend<PROBLEM>(
  row: number,
  col: number,
  problem: PROBLEM,
  contextStack: immutable.Stack<{ row: number; col: number; context: unknown }>
): DeadEnd<PROBLEM> {
  return {
    row,
    col,
    problem,
    contextStack,
  };
}

type Bag<PROBLEM> = Empty | AddRight<PROBLEM> | Append<PROBLEM>;

// Empty

type Empty = typeof Empty;

const Empty = {
  kind: "Empty",
} as const;

function isEmpty(bag: Bag<any>): bag is Empty {
  return bag.kind === "Empty";
}

// AddRight

type AddRight<PROBLEM> = {
  kind: "AddRight";
  bag: Bag<PROBLEM>;
  deadEnd: DeadEnd<PROBLEM>;
};

function AddRight<PROBLEM>(
  bag: Bag<PROBLEM>,
  deadEnd: DeadEnd<PROBLEM>
): AddRight<PROBLEM> {
  return {
    kind: "AddRight",
    bag: bag,
    deadEnd: deadEnd,
  };
}

function isAddRight<PROBLEM>(bag: Bag<PROBLEM>): bag is AddRight<PROBLEM> {
  return bag.kind === "AddRight";
}

// Append

type Append<PROBLEM> = {
  kind: "Append";
  left: Bag<PROBLEM>;
  right: Bag<PROBLEM>;
};

function Append<PROBLEM>(
  left: Bag<PROBLEM>,
  right: Bag<PROBLEM>
): Append<PROBLEM> {
  return {
    kind: "Append",
    left: left,
    right: right,
  };
}

function isAppend<PROBLEM>(bag: Bag<PROBLEM>): bag is Append<PROBLEM> {
  return bag.kind === "Append";
}

// Bag transforms

function fromState<PROBLEM>(state: State, p: PROBLEM): Bag<PROBLEM> {
  return AddRight(Empty, Deadend(state.row, state.col, p, state.context));
}

function fromInfo<PROBLEM>(
  row: number,
  col: number,
  p: PROBLEM,
  context: immutable.Stack<{ row: number; col: number; context: unknown }>
): Bag<PROBLEM> {
  return AddRight(Empty, Deadend(row, col, p, context));
}

function bagToList<PROBLEM>(bag: Bag<PROBLEM>): DeadEnd<PROBLEM>[] {
  const workList = [bag];
  const list: DeadEnd<PROBLEM>[] = [];

  while (workList.length > 0) {
    const currentBag: Bag<PROBLEM> = workList.pop() as any;
    if (isAddRight(currentBag)) {
      list.push(currentBag.deadEnd);
      workList.push(currentBag.bag);
    } else if (isAppend(currentBag)) {
      // Note that the order of these statements are important to the
      // final order of the list
      workList.push(currentBag.right);
      workList.push(currentBag.left);
    }
    // Ignore Empty bags
  }

  return list.reverse();
}

// PStep

type PStep<A, PROBLEM> = Good<A> | Bad<PROBLEM>;

type Good<A> = {
  kind: "Good";
  flag: boolean; // if true, reached an unrecoverable error
  value: A;
  ctx: State;
};

function Good<A>(
  flag: boolean, // if true, reached an end state
  value: A,
  ctx: State
): Good<A> {
  return {
    kind: "Good",
    flag,
    value,
    ctx,
  };
}

function isGood<A>(x: PStep<A, any>): x is Good<A> {
  return typeof x === "object" && x.kind === "Good";
}

type Bad<PROBLEM> = {
  kind: "Bad";
  flag: boolean; // if true, reached an end state
  bag: Bag<PROBLEM>;
};

function Bad<PROBLEM>(flag: boolean, bag: Bag<PROBLEM>): Bad<PROBLEM> {
  return {
    kind: "Bad",
    flag,
    bag,
  };
}

function isBad<PROBLEM>(x: PStep<any, PROBLEM>): x is Bad<PROBLEM> {
  return typeof x === "object" && x.kind === "Bad";
}

/**
 * Returns the argument of the function or a type error
 *
 * @category Helper Types
 */
export type ArgumentTypesP<F> = F extends (arg: infer A) => any
  ? A
  : "Error: The left hand side must be function";

/**
 * Returns the return type or reports a type error
 *
 * @category Helper Types
 */
export type ReturnTypeP<F> = F extends (arg: any) => any
  ? ReturnType<F>
  : "Error: The left hand side must be a function";

/**
 * Pick what ever option is not never. Fail if both are not never.
 *
 * @example
 *
 * If `A` and `B`are distinct types then:
 *
 * ```ts
 * type IsNever     = Unify<never, never> // => never
 * type IsA<A>      = Unify<A, never>     // => A
 * type IsB<B>      = Unify<never, B>     // => B
 * type Error<A, B> = Unify<A, B>         // => "Error: ..."
 * ```
 *
 */
type Unify<A, B> = A extends never
  ? B
  : B extends never
  ? A
  : "Could not unify";

/**
 * A parser: a function from a string into structured object(s).
 *
 * @remarks
 * You can think of this class as a simple wrapper around the function
 * `TODO`
 *
 * @typeParam A   - When the parser succeeds it returns a value
 * @typeParam PROBLEM - When the parser fails it returns a problem
 * @typeParam CTX     - Extra information about any problem that occured
 *
 * @category Parsers
 */
export interface Parser<A, PROBLEM> {
  /**
   * **WARNING:** Do not use directly, it is used by the library
   *
   * @private
   */
  exec: (s: State) => PStep<A, PROBLEM>;

  /**
   * Transform the result of a parser. Maybe you have a value that is
   * an integer or `null`:
   *
   * @example
   *
   * ```ts
   * const nullOrInt: Parser<number | undefined> = oneOf(
   *  int,
   *  keyword("null").map((_) => undefined)
   *  );
   *
   * // run(nullOrInt)("0")    ==> Ok(0)
   * // run(nullOrInt)("13")   ==> Ok(13)
   * // run(nullOrInt)("null") ==> Ok(undefined)
   * // run(nullOrInt)("zero") ==> Err ...
   * ```
   *
   *
   * @param fn - the function to apply to the result
   * @returns a new parser with a transformed result
   *
   * @category Mapping
   */
  map<B>(fn: (v: A) => B): Parser<B, PROBLEM>;

  /**
   *
   * 
   * Parse one thing `andThen` parse another thing. This is useful when you want
   * to check on what you just parsed. For example, maybe you want U.S. zip codes
   * and `int` is not suitable because it does not allow leading zeros. You could
   * say:
   *
   * 
   * TODO: Rewrite to typescript
   * 
   * ```elm
   *  zipCode : Parser String
   *  zipCode =
   *    getChompedString (chompWhile Char.isDigit)
   *      |> andThen checkZipCode
   * 
   *  checkZipCode : String -> Parser String
   *  checkZipCode code =
   *    if String.length code == 5 then
   *      succeed code
   *    else
   *     problem "a U.S. zip code has exactly 5 digits"
   *```

   * First we chomp digits `andThen` we check if it is a valid U.S. zip code. We
   * `succeed` if it has exactly five digits and report a `problem` if not.
   *
   * Check out [`examples/DoubleQuoteString.elm`](https://github.com/elm/parser/blob/master/examples/DoubleQuoteString.elm)
   * for another example, this time using `andThen` to verify unicode code points.
   *
   * **Note:** If you are using `andThen` recursively and blowing the stack, check
   * out the {@link loop} function to limit stack usage.
   *
   * @param fn - a function that returns a new parser
   * @returns a new parser where the nested parsers have been flatten
   * 
   * @category Mapping
   */
  andThen<B, PROBLEM2>(
    fn: (v: A) => Parser<B, PROBLEM2>
  ): Parser<B, PROBLEM | PROBLEM2>;

  /**
   * Skip the return value of the parser it is given.
   *
   * @remarks
   * The infix version of {@link skip2nd}
   *
   * @category Mapping
   */
  skip<PROBLEM2>(
    other: Parser<unknown, PROBLEM2>
  ): Parser<A, PROBLEM | PROBLEM2>;

  /**
   * Keep the return value of the parser it is given, and ignore the previous value.
   *
   * @example
   * Just a shorthand for `yourParser.andThen(() => ...)`
   *
   * @category Mapping
   */
  keep<B, PROBLEM2>(other: Parser<B, PROBLEM2>): Parser<B, PROBLEM | PROBLEM2>;

  /**
   * **Apply** values in a parser pipeline. For example, we could say:
   *
   * **NOTE:** You can only use `.apply(...)` on a parser that contains a
   * function that is curried.
   *
   * ```ts
   * type Point = {
   *    x: number;
   *    y: number;
   * };
   *
   * const createPoint =
   *    (x: number) =>
   *    (y: number): Point => ({ x, y });
   *
   * const point: Parser<Point> = succeed(createPoint)
   *    .skip(symbol("("))
   *    .skip(spaces)
   *    .apply(float)
   *    .skip(symbol(","))
   *    .skip(spaces)
   *    .apply(float)
   *    .skip(spaces)
   *    .skip(symbol(")"));
   * ```
   *
   * @param parser - the parser who's value we will keep
   * @returns a new parser with the result applied to the curried function
   *
   * @category Mapping
   */
  apply<PROBLEM2>(
    parser: Parser<ArgumentTypesP<A>, PROBLEM2>
  ): Parser<ReturnTypeP<A>, PROBLEM | PROBLEM2>;

  /**
   * Just like {@link Simple!oneOf} but only between *two* different parsers
   *
   * **NOTE:** The left side is checked first!
   *
   * @category Branches
   */
  or<B, PROBLEM2>(
    other: Parser<B, PROBLEM2>
  ): Parser<A | B, PROBLEM | PROBLEM2>;

  /**
   * Just like {@link Simple!run}
   *
   * @category Parsers
   */
  run(src: string): Results.Result<A, DeadEnd<PROBLEM>[]>;

  /**
   * Just like {@link Simple!backtrackable}
   *
   * @category Branches
   */
  backtrackable(): Parser<A, PROBLEM>;

  /**
   * Just like {@link Simple!getChompedString}
   *
   * @category Chompers
   */
  getChompedString(): Parser<string, PROBLEM>;

  /**
   * Just like {@link Simple!mapChompedString}
   *
   * @category Chompers
   */
  mapChompedString<B>(fn: (s: string, v: A) => B): Parser<B, PROBLEM>;

  /**
   * Just like {@link Simple!getIndent}
   *
   * @category Indentation
   */
  getIndent(): Parser<number, PROBLEM>;

  /**
   * Just like {@link Simple!withIndent}
   *
   * @category Indentation
   */
  withIndent(newIndent: number): Parser<A, PROBLEM>;

  /**
   *  Just like {@link Simple!getPosition}
   *
   * @category Positions
   */
  getPosition(): Parser<[number, number], PROBLEM>;

  /**
   * Just like {@link Simple!getRow}
   *
   * @category Positions
   */
  getRow(): Parser<number, PROBLEM>;

  /**
   * Just like {@link Simple!getCol}
   * @category Positions
   */
  getCol(): Parser<number, PROBLEM>;

  /**
   * Just like {@link Simple!getOffset}
   *
   * @category Positions
   */
  getOffset(): Parser<number, PROBLEM>;

  /**
   * Just like {@link Simple!getSource}
   *
   * @category Positions
   */
  getSource(): Parser<string, PROBLEM>;
}
/**
 * @hidden
 */
class ParserImpl<A, PROBLEM> implements Parser<A, PROBLEM> {
  constructor(public exec: (s: State) => PStep<A, PROBLEM>) {}

  map<B>(fn: (v: A) => B): Parser<B, PROBLEM> {
    return map(fn)(this);
  }

  andThen<B, PROBLEM2>(
    fn: (v: A) => Parser<B, PROBLEM2>
  ): Parser<B, PROBLEM | PROBLEM2> {
    return andThen(fn)(this);
  }

  skip<PROBLEM2>(
    other: Parser<unknown, PROBLEM2>
  ): Parser<A, PROBLEM | PROBLEM2> {
    return skip2nd(this)(other);
  }

  keep<B, PROBLEM2>(other: Parser<B, PROBLEM2>): Parser<B, PROBLEM | PROBLEM2> {
    return this.andThen(() => other);
  }

  apply<PROBLEM2>(
    parser: Parser<ArgumentTypesP<A>, PROBLEM2>
  ): Parser<ReturnTypeP<A>, PROBLEM | PROBLEM2> {
    return apply(
      this as Parser<(a: ArgumentTypesP<A>) => ReturnTypeP<A>, PROBLEM>
    )(parser);
  }

  run(src: string): Results.Result<A, DeadEnd<PROBLEM>[]> {
    return run(this)(src);
  }

  or<B, PROBLEM2>(
    other: Parser<B, PROBLEM2>
  ): Parser<A | B, PROBLEM | PROBLEM2> {
    return oneOf(this, other);
  }

  backtrackable(): Parser<A, PROBLEM> {
    return backtrackable(this);
  }

  getChompedString(): Parser<string, PROBLEM> {
    return getChompedString(this);
  }

  mapChompedString<B>(fn: (s: string, v: A) => B): Parser<B, PROBLEM> {
    return mapChompedString(fn)(this);
  }

  getIndent(): Parser<number, PROBLEM> {
    return this.keep(getIndent);
  }

  withIndent(newIndent: number): Parser<A, PROBLEM> {
    return withIndent(newIndent)(this);
  }

  getPosition(): Parser<[number, number], PROBLEM> {
    return this.keep(getPosition);
  }
  getRow(): Parser<number, PROBLEM> {
    return this.keep(getRow);
  }
  getCol(): Parser<number, PROBLEM> {
    return this.keep(getCol);
  }
  getOffset(): Parser<number, PROBLEM> {
    return this.keep(getOffset);
  }
  getSource(): Parser<string, PROBLEM> {
    return this.keep(getSource);
  }
}

// Run

/**
 * This works just like {@link Simple!run}.
 * The only difference is that when it fails, it has much more precise information
 * for each dead end.
 *
 * @category Parsers
 */
export const run =
  <A, PROBLEM>(parser: Parser<A, PROBLEM>) =>
  (src: string): Results.Result<A, DeadEnd<PROBLEM>[]> => {
    const res = parser.exec({
      src: src,
      offset: 0,
      indent: 0,
      context: immutable.Stack(),
      row: 1,
      col: 1,
    });

    if (isGood(res)) {
      return Results.Ok(res.value);
    } else {
      return Results.Err(bagToList(res.bag));
    }
  };

// PRIMITIVES

/**
 *
 * Just like {@link Simple!succeed}
 *
 * @category Primitives
 */
export function succeed<A>(a: A): Parser<A, never> {
  return new ParserImpl((s) => Good(false, a, s));
}

/**
 *
 *  Just like {@link Simple!problem} except you provide a custom
 *  type for your problem.
 *
 * @category Primitives
 */
export function problem<PROBLEM>(p: PROBLEM): Parser<never, PROBLEM> {
  return new ParserImpl((s) => Bad(false, fromState(s, p)));
}

// MAPPING

/**
 * A curried version of the {@link Parser.map | map } method on the Parser class.
 *
 * @category Mapping
 */
export const map =
  <A, B>(fn: (a: A) => B) =>
  <PROBLEM>(parser: Parser<A, PROBLEM>): Parser<B, PROBLEM> => {
    return new ParserImpl((s) => {
      const res = parser.exec(s);
      if (isGood(res)) {
        return Good(res.flag, fn(res.value), res.ctx);
      } else {
        return res;
      }
    });
  };

/**
 * Just like {@link Simple!map2}
 *
 * @category Mapping
 */
export const map2 =
  <A, B, C>(fn: (a: A, b: B) => C) =>
  <PROBLEM>(parserA: Parser<A, PROBLEM>) =>
  <PROBLEM2>(parserB: Parser<B, PROBLEM2>): Parser<C, PROBLEM | PROBLEM2> => {
    return new ParserImpl((s0): PStep<C, PROBLEM | PROBLEM2> => {
      const res0 = parserA.exec(s0);
      if (isBad(res0)) {
        return res0;
      } else {
        const res1 = parserB.exec(res0.ctx);
        if (isBad(res1)) {
          return Bad(res0.flag || res1.flag, res1.bag);
        } else {
          return Good(
            res0.flag || res1.flag,
            fn(res0.value, res1.value),
            res1.ctx
          );
        }
      }
    });
  };

/**
 * A curried version of the {@link Parser.apply| apply} method on the Parser class.
 *
 * @category Mapping
 */
export const apply =
  <A, B, PROBLEM>(parseFunc: Parser<(a: A) => B, PROBLEM>) =>
  <PROBLEM2>(parseArg: Parser<A, PROBLEM2>): Parser<B, PROBLEM | PROBLEM2> => {
    return map2((fn: (a: A) => B, arg: A) => fn(arg))(parseFunc)(parseArg);
  };

/**
 * Like {@link skip2nd | skip2nd } but skips the first argument instead of the second.
 *
 * @category Mapping
 */
export const skip1st =
  <PROBLEM>(first: Parser<unknown, PROBLEM>) =>
  <A, PROBLEM2>(second: Parser<A, PROBLEM2>): Parser<A, PROBLEM | PROBLEM2> => {
    return map2((a, b: A) => b)(first)(second);
  };

/**
 * A curried version of the {@link Parser.skip | skip } method on the Parser class.
 * See {@link skip1st | skip1st } for a function that skips it's first argument.
 *
 * @category Mapping
 */
export const skip2nd =
  <A, PROBLEM>(keepParser: Parser<A, PROBLEM>) =>
  <PROBLEM2>(
    ignoreParser: Parser<unknown, PROBLEM2>
  ): Parser<A, PROBLEM | PROBLEM2> => {
    return map2((a: A, b) => a)(keepParser)(ignoreParser);
  };

// AND THEN

/**
 * A curried version of the {@link Parser.andThen | andThen } method on the Parser class.
 *
 * @category Mapping
 */
export const andThen =
  <A, B, PROBLEM>(fn: (a: A) => Parser<B, PROBLEM>) =>
  <PROBLEM2>(p: Parser<A, PROBLEM2>): Parser<B, PROBLEM | PROBLEM2> => {
    return new ParserImpl((ctx0): PStep<B, PROBLEM | PROBLEM2> => {
      const res1 = p.exec(ctx0);

      if (isBad(res1)) {
        return res1;
      } else {
        const res2 = fn(res1.value).exec(res1.ctx);
        if (isBad(res2)) {
          return Bad(res1.flag || res2.flag, res2.bag);
        } else {
          return Good(res1.flag || res2.flag, res2.value, res2.ctx);
        }
      }
    });
  };

// LAZY

/**
 * Just like {@link Simple!lazy}
 *
 * @category Helpers
 */
export const lazy = <A, PROBLEM>(
  thunk: () => Parser<A, PROBLEM>
): Parser<A, PROBLEM> => {
  return new ParserImpl((ctx) => {
    return thunk().exec(ctx);
  });
};

// ONE OF

/**
 * Just like {@link Simple!oneOf}
 *
 * @category Branches
 */
export function oneOf<A, PROBLEM>(one: Parser<A, PROBLEM>): Parser<A, PROBLEM>;

export function oneOf<A, B, PROBLEM1, PROBLEM2>(
  one: Parser<A, PROBLEM1>,
  two: Parser<B, PROBLEM2>
): Parser<A | B, PROBLEM1 | PROBLEM2>;

export function oneOf<A, B, C, PROBLEM1, PROBLEM2, PROBLEM3>(
  one: Parser<A, PROBLEM1>,
  two: Parser<B, PROBLEM2>,
  three: Parser<C, PROBLEM3>
): Parser<A | B | C, PROBLEM1 | PROBLEM2 | PROBLEM3>;

export function oneOf<A, B, C, D, PROBLEM1, PROBLEM2, PROBLEM3, PROBLEM4>(
  one: Parser<A, PROBLEM1>,
  two: Parser<B, PROBLEM2>,
  three: Parser<C, PROBLEM3>,
  four: Parser<D, PROBLEM4>
): Parser<A | B | C | D, PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4>;

export function oneOf<
  A,
  B,
  C,
  D,
  E,
  PROBLEM1,
  PROBLEM2,
  PROBLEM3,
  PROBLEM4,
  PROBLEM5
>(
  one: Parser<A, PROBLEM1>,
  two: Parser<B, PROBLEM2>,
  three: Parser<C, PROBLEM3>,
  four: Parser<D, PROBLEM4>,
  five: Parser<E, PROBLEM5>
): Parser<
  A | B | C | D | E,
  PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4 | PROBLEM5
>;

export function oneOf<A, PROBLEM>(
  ...parsers: Parser<A, PROBLEM>[]
): Parser<A, PROBLEM> {
  return oneOfMany(...parsers);
}

/**
 * Just like {@link Simple!oneOfMany}
 *
 * @category Branches
 */
export function oneOfMany<A, PROBLEM>(
  ...parsers: Parser<A, PROBLEM>[]
): Parser<A, PROBLEM> {
  return new ParserImpl((ctx) => oneOfHelp(ctx, Empty, parsers));
}

function oneOfHelp<A, PROBLEM>(
  ctx0: State,
  bag: Bag<PROBLEM>,
  parsers: Parser<A, PROBLEM>[]
): PStep<A, PROBLEM> {
  let localBag = bag;

  for (const parser of parsers) {
    const res = parser.exec(ctx0);
    if (isGood(res) || res.flag) {
      return res;
    }
    localBag = Append(localBag, res.bag);
  }

  return Bad(false, localBag);
}

// LOOP

/**
 * Just like {@link Simple!Step}
 *
 * @category Loop (All)
 */
export type Step<STATE, A> = Loop<STATE> | Done<A>;

/**
 * @category Loop (All)
 */
export type Loop<STATE> = {
  readonly kind: "LOOP";
  readonly value: STATE;
};

/**
 * When you want to continue your {@link Simple!loop}
 *
 * @param state - the state for the next iteration of the loop
 * @returns an indication to continue the loop
 *
 * @category Loop (All)
 */
export function Loop<STATE>(state: STATE): Loop<STATE> {
  return {
    kind: "LOOP",
    value: state,
  };
}

/**
 * @category Loop (All)
 */
export type Done<A> = {
  readonly kind: "DONE";
  readonly value: A;
};

/**
 * When oyu want to complete your {@link loop}
 *
 * @param value - the return value
 * @returns a then end of a loop
 *
 * @category Loop (All)
 */
export function Done<A>(value: A): Done<A> {
  return {
    kind: "DONE",
    value: value,
  };
}

/**
 * @category Loop (All)
 */
export function isLoop<STATE>(x: Step<STATE, unknown>): x is Loop<STATE> {
  return x.kind === "LOOP";
}

/**
 * @category Loop (All)
 */
export function isDone<A>(x: Step<unknown, A>): x is Done<A> {
  return x.kind === "DONE";
}

/**
 * Just like {@link Simple!loop}
 *
 * @category Loops
 * @category Loop (All)
 */
export const loop =
  <STATE>(state: STATE) =>
  <A, PROBLEM>(
    fn: (state: STATE) => Parser<Step<STATE, A>, PROBLEM>
  ): Parser<A, PROBLEM> => {
    return new ParserImpl((s) => loopHelp(state, fn, s));
  };

const loopHelp = <STATE, A, PROBLEM>(
  state: STATE,
  fn: (state: STATE) => Parser<Step<STATE, A>, PROBLEM>,
  s: State
): PStep<A, PROBLEM> => {
  let tmpState = state;
  let tmpS = s;
  let p = false;

  while (true) {
    let parse = fn(tmpState);
    let res = parse.exec(tmpS);

    if (isGood(res)) {
      const val = res.value;
      p = p || res.flag;
      if (isLoop(val)) {
        tmpState = val.value;
        tmpS = res.ctx;
      } else {
        return Good(p, val.value, tmpS);
      }
    } else {
      return Bad(p, res.bag);
    }
  }
};

// BACKTRACKABLE

/**
 * Just like {@link Simple!backtrackable}
 *
 * @category Branches
 */
export const backtrackable = <A, PROBLEM>(
  parser: Parser<A, PROBLEM>
): Parser<A, PROBLEM> => {
  return new ParserImpl((ctx) => {
    const res = parser.exec(ctx);
    if (isBad(res)) {
      return Bad(false, res.bag);
    } else {
      return Good(false, res.value, res.ctx);
    }
  });
};

/**
 * Just like {@link Simple!commit}
 *
 * @category Branches
 */
export const commit = <A>(a: A): Parser<A, never> => {
  return new ParserImpl((s) => Good(true, a, s));
};

// Unit

/**
 * When you want to return a value but no information. Typescript/Javascript
 * has no direct support for this but we can emulate it by create a type alias
 * for false.
 *
 * @see {@link Unit:var | The Unit constant}
 *
 * @category Helper Types
 */
export type Unit = false;

/**
 * {@inheritDoc Unit:type}
 *
 * @see {@link Unit:type | The Unit type}
 *
 * @category Helper Types
 */
export const Unit: Unit = false;

// Token

/**
 * With the simpler `Parser` module, you could just say `symbol(",")` and
 * parse all the commas you wanted. But now that we have a custom type for our
 * problems, we actually have to specify that as well. So anywhere you just used
 * a `string` in the simpler module, you now use a `Token<Problem>` in the advanced
 * module:
 *
 * ```ts
 *  enum Problem {
 *   ExpectingComma,
 *   ExpectingListEnd
 *  }
 *
 * const comma = Token(",", Problem.ExpectingComma)
 *
 * const listEnd = Token("]", Problem.ExpectingListEnd)
 *
 * ```
 *
 * You can be creative with your custom type. Maybe you want a lot of detail.
 * Maybe you want looser categories. It is a custom type. Do what makes sense for
 * you!
 *
 * @category Token (All)
 */
export type Token<PROBLEM> = {
  value: string;
  problem: PROBLEM;
};

/**
 *
 * @param value - the token we are trying to parse
 * @param problem - the error if we fail to parse the token
 * @returns a Token
 *
 * @category Token (All)
 */
export function Token<PROBLEM>(
  value: string,
  problem: PROBLEM
): Token<PROBLEM> {
  return {
    value: value,
    problem: problem,
  };
}

/**
 * Just like {@link Simple!token} except you provide a `Token`
 * specifying your custom type of problems.
 *
 * @category Branches
 * @category Token (All)
 */
export function token<PROBLEM>(token: Token<PROBLEM>): Parser<Unit, PROBLEM> {
  const progress = token.value.length !== 0;
  return new ParserImpl((s) => {
    const [newOffset, newRow, newCol] = Helpers.isSubString(
      token.value,
      s.offset,
      s.row,
      s.col,
      s.src
    );
    if (newOffset === -1) {
      return Bad(false, fromState(s, token.problem));
    } else {
      return Good(progress, Unit, {
        src: s.src,
        offset: newOffset,
        indent: s.indent,
        context: s.context,
        row: newRow,
        col: newCol,
      });
    }
  });
}

// Number

/**
 * Just like {@link Simple!int} where you have to handle negation
 * yourself. The only difference is that you provide a two potential problems:
 *
 * ```ts
 * const int =
 * <PROBLEM>(expecting: PROBLEM) =>
 * (invalid: PROBLEM): Parser<PROBLEM, number> => {
 *   return number({
 *     int: Ok((id: number) => id),
 *     hex: Err(invalid),
 *     octal: Err(invalid),
 *     binary: Err(invalid),
 *     float: Err(invalid),
 *     invalid: invalid,
 *     expecting: expecting,
 *   });
 * };
 * ```
 *
 * You can use problems like `ExpectingInt` and `InvalidNumber`.
 *
 * @category Building Blocks
 */
export const int =
  <PROBLEM>(expecting: PROBLEM) =>
  (invalid: PROBLEM): Parser<number, PROBLEM> => {
    return number({
      int: Ok((id: number) => id),
      hex: Err(invalid),
      octal: Err(invalid),
      binary: Err(invalid),
      float: Err(invalid),
      invalid: invalid,
      expecting: expecting,
    });
  };

/**
 * Just like {@link Simple!float} where you have to handle negation
 * yourself. The only difference is that you provide a two potential problems:
 *
 * ```ts
 * const float =
 * <PROBLEM>(expecting: PROBLEM) =>
 * (invalid: PROBLEM): Parser<PROBLEM, number> => {
 *   return number({
 *     int: Ok((id: number) => id),
 *     hex: Err(invalid),
 *     octal: Err(invalid),
 *     binary: Err(invalid),
 *     float: Ok((id: number) => id),
 *     invalid: invalid,
 *     expecting: expecting,
 *   });
 * };
 * ```
 *
 * @category Building Blocks
 */
export const float =
  <PROBLEM>(expecting: PROBLEM) =>
  (invalid: PROBLEM): Parser<number, PROBLEM> => {
    return number({
      int: Ok((id: number) => id),
      hex: Err(invalid),
      octal: Err(invalid),
      binary: Err(invalid),
      float: Ok((id: number) => id),
      invalid: invalid,
      expecting: expecting,
    });
  };

/**
 * TODO: I think a better API would avoid the use of result here since it isn't strictly needed
 *
 * Just like {@link Simple!number} where you have to handle
 * negation yourself. The only difference is that you provide all the potential
 * problems.
 *
 * @category Building Blocks
 */
export function number<A, PROBLEM>(args: {
  int: Result<(n: number) => A, PROBLEM>;
  hex: Result<(n: number) => A, PROBLEM>;
  octal: Result<(n: number) => A, PROBLEM>;
  binary: Result<(n: number) => A, PROBLEM>;
  float: Result<(n: number) => A, PROBLEM>;
  invalid: PROBLEM;
  expecting: PROBLEM;
}): Parser<A, PROBLEM> {
  return new ParserImpl((s) => {
    // 0x30 => 0
    if (Helpers.isCharCode(0x30, s.offset, s.src)) {
      const zeroOffset = s.offset + 1;
      const baseOffset = zeroOffset + 1;

      // 0x78 => x
      if (Helpers.isCharCode(0x78, zeroOffset, s.src)) {
        // HEX
        return finalizeInt(
          args.invalid,
          args.hex,
          baseOffset,
          Helpers.consumeBase16(baseOffset, s.src),
          s
        );

        // 0x6f => o
      } else if (Helpers.isCharCode(0x6f, zeroOffset, s.src)) {
        // OCTAL
        return finalizeInt(
          args.invalid,
          args.octal,
          baseOffset,
          Helpers.consumeBase(8, baseOffset, s.src),
          s
        );
        // 0x62 => b
      } else if (Helpers.isCharCode(0x62, zeroOffset, s.src)) {
        // BINARY
        return finalizeInt(
          args.invalid,
          args.binary,
          baseOffset,
          Helpers.consumeBase(2, baseOffset, s.src),
          s
        );
      } else {
        // Float
        return finalizeFloat(
          args.invalid,
          args.expecting,
          args.int,
          args.float,
          [zeroOffset, 0],
          s
        );
      }
    }
    // Float
    return finalizeFloat(
      args.invalid,
      args.expecting,
      args.int,
      args.float,
      Helpers.consumeBase(10, s.offset, s.src),
      s
    );
  });
}

function finalizeInt<A, PROBLEM>(
  invalid: PROBLEM,
  handler: Result<(n: number) => A, PROBLEM>,
  startOffset: number,
  [endOffset, n]: [number, number],
  s: State
): PStep<A, PROBLEM> {
  if (handler.err) {
    return Bad(true, fromState(s, handler.val));
  } else {
    if (startOffset === endOffset) {
      return Bad(s.offset < startOffset, fromState(s, invalid));
    } else {
      return Good(true, handler.val(n), bumpOffset(endOffset, s));
    }
  }
}

function bumpOffset(newOffset: number, s: State): State {
  return {
    src: s.src,
    offset: newOffset,
    indent: s.indent,
    context: s.context,
    row: s.row,
    col: s.col + (newOffset - s.offset),
  };
}

function finalizeFloat<A, PROBLEM>(
  invalid: PROBLEM,
  expecting: PROBLEM,
  intSettings: Result<(n: number) => A, PROBLEM>,
  floatSettings: Result<(n: number) => A, PROBLEM>,
  floatPair: [number, number],
  s: State
): PStep<A, PROBLEM> {
  const intOffset = floatPair[0];
  const floatOffset = consumeDotAndExp(intOffset, s.src);

  if (floatOffset < 0) {
    return Bad(
      true,
      fromInfo(s.row, s.col - (floatOffset + s.offset), invalid, s.context)
    );
  } else if (s.offset === floatOffset) {
    return Bad(false, fromState(s, expecting));
  } else if (intOffset === floatOffset) {
    return finalizeInt(invalid, intSettings, s.offset, floatPair, s);
  } else {
    if (floatSettings.err) {
      return Bad(true, fromState(s, floatSettings.val));
    } else {
      try {
        const n = parseFloat(s.src.slice(s.offset, floatOffset));
        return Good(true, floatSettings.val(n), bumpOffset(floatOffset, s));
      } catch (e) {
        return Bad(true, fromState(s, invalid));
      }
    }
  }
}

/**
 * On a failure, returns negative index of problem.
 *
 * @param offset - the offset
 * @param src - the src string
 */
function consumeDotAndExp(offset: number, src: string): number {
  // 0x2e => '.'
  if (Helpers.isCharCode(0x2e, offset, src)) {
    return consumeExp(Helpers.chompBase10(offset + 1, src), src);
  } else {
    return consumeExp(offset, src);
  }
}

/**
 * On a failure, returns negative index of problem.
 *
 * @param offset - the offset
 * @param src - the src string
 */
function consumeExp(offset: number, src: string): number {
  // 0x65 => 'e'
  // 0x45 => 'E'
  if (
    Helpers.isCharCode(0x65, offset, src) ||
    Helpers.isCharCode(0x45, offset, src)
  ) {
    const eOffset = offset + 1;
    // 0x2b => '+'
    // 0x2d => '-'
    const expOffset =
      Helpers.isCharCode(0x2b, offset, src) ||
      Helpers.isCharCode(0x2d, offset, src)
        ? eOffset + 1
        : eOffset;

    const newOffset = Helpers.chompBase10(expOffset, src);
    if (expOffset === newOffset) {
      return -newOffset;
    } else {
      return newOffset;
    }
  } else {
    return offset;
  }
}

// END

/**
 * Just like {@link Simple!end} except you provide the problem that
 * arises when the parser is not at the end of the input.
 *
 * @category Building Blocks
 */
export const end = <PROBLEM>(problem: PROBLEM): Parser<Unit, PROBLEM> => {
  return new ParserImpl((s) => {
    if (s.src.length === s.offset) {
      return Good(false, Unit, s);
    } else {
      return Bad(false, fromState(s, problem));
    }
  });
};

// CHOMPED STRINGS

/**
 * Just like {@link Simple!getChompedString}
 *
 * @category Chompers
 */
export const getChompedString = <A, PROBLEM>(
  parser: Parser<A, PROBLEM>
): Parser<string, PROBLEM> => {
  return mapChompedString((a) => a)(parser);
};

/**
 * Just like {@link Simple!mapChompedString}
 *
 * @category Chompers
 */
export const mapChompedString =
  <A, B>(fn: (s: string, v: A) => B) =>
  <PROBLEM>(parser: Parser<A, PROBLEM>): Parser<B, PROBLEM> => {
    return new ParserImpl((s) => {
      const res = parser.exec(s);
      if (isBad(res)) {
        return res;
      } else {
        return Good(
          res.flag,
          fn(s.src.slice(s.offset, res.ctx.offset), res.value),
          res.ctx
        );
      }
    });
  };

// CHOMP IF

/**
 * Just like {@link Simple!chompIf} except you provide a problem
 * in case a character cannot be chomped.
 *
 * @category Chompers
 */
export const chompIf =
  (isGood: (char: string) => boolean) =>
  <PROBLEM>(expecting: PROBLEM): Parser<Unit, PROBLEM> => {
    return new ParserImpl((s) => {
      const newOffset = Helpers.isSubChar(isGood, s.offset, s.src);
      if (newOffset === -1) {
        return Bad(false, fromState(s, expecting));
      } else if (newOffset === -2) {
        return Good(true, Unit, {
          src: s.src,
          offset: s.offset + 1,
          indent: s.indent,
          context: s.context,
          row: s.row + 1,
          col: 1,
        });
      } else {
        return Good(true, Unit, {
          src: s.src,
          offset: newOffset,
          indent: s.indent,
          context: s.context,
          row: s.row,
          col: s.col + 1,
        });
      }
    });
  };

// CHOMP WHILE

/**
 * Just like {@link Simple!chompWhile}
 *
 * @category Chompers
 */
export const chompWhile = (
  isGood: (char: string) => boolean
): Parser<Unit, never> => {
  return new ParserImpl((s) =>
    chompWhileHelp(isGood, s.offset, s.row, s.col, s)
  );
};

function chompWhileHelp(
  isGood: (char: string) => boolean,
  offset: number,
  row: number,
  col: number,
  s0: State
): PStep<Unit, never> {
  let finalOffset = offset;
  let finalRow = row;
  let finalCol = col;

  let newOffset = Helpers.isSubChar(isGood, offset, s0.src);

  while (newOffset !== -1) {
    if (newOffset === -2) {
      finalOffset = finalOffset + 1;
      finalRow = finalRow + 1;
      finalCol = 1;
    } else {
      finalOffset = newOffset;
      finalCol = finalCol + 1;
    }

    newOffset = Helpers.isSubChar(isGood, finalOffset, s0.src);
  }

  return Good(s0.offset < finalOffset, Unit, {
    src: s0.src,
    offset: finalOffset,
    indent: s0.indent,
    context: s0.context,
    row: finalRow,
    col: finalCol,
  });
}

// CHOMP UNTIL

/**
 * Just like {@link Simple!chompUntil} except you provide a
 * `Token` in case you chomp all the way to the end of the input without finding
 * what you need.
 *
 * @category Chompers
 */
export const chompUntil = <PROBLEM>(
  token: Token<PROBLEM>
): Parser<Unit, PROBLEM> => {
  return new ParserImpl((s) => {
    const [newOffset, newRow, newCol] = Helpers.findSubString(
      token.value,
      s.offset,
      s.row,
      s.col,
      s.src
    );
    if (newOffset === -1) {
      return Bad(false, fromInfo(newRow, newCol, token.problem, s.context));
    } else {
      return Good(s.offset < newOffset, Unit, {
        src: s.src,
        offset: newOffset,
        indent: s.indent,
        context: s.context,
        row: newRow,
        col: newCol,
      });
    }
  });
};

/**
 * Just like {@link Simple!chompUntilEndOr}
 *
 * @category Chompers
 */
export const chompUntilEndOr = (str: string): Parser<Unit, never> => {
  return new ParserImpl((s) => {
    const [newOffset, newRow, newCol] = Helpers.findSubString(
      str,
      s.offset,
      s.row,
      s.col,
      s.src
    );
    const [finalOffset, finalRow, finalCol] = Helpers.isSubString(
      str,
      newOffset,
      newRow,
      newCol,
      s.src
    );
    const adjustedOffset = finalOffset < 0 ? s.src.length : finalOffset;
    return Good(s.offset < adjustedOffset, Unit, {
      src: s.src,
      offset: adjustedOffset,
      indent: s.indent,
      context: s.context,
      row: finalRow,
      col: finalCol,
    });
  });
};

// CONTEXT

/**
 * This is how you mark that you are in a certain context. For example, here
 * is a rough outline of some code that uses `inContext` to mark when you are
 * parsing a specific definition:
 *
 * @example
 *
 * ```ts
 * type Context =
 *   | {
 *       kind: "Definition";
 *       str: string;
 *     }
 *   | { kind: "List" };
 *
 * const functionName = P.variable({
 *   start: Helpers.isLower,
 *   inner: Helpers.isAlphaNum,
 *   reserved: new Set(["let", "in"]),
 *   expecting: ExpectingFunctionName,
 * });
 *
 * const definitionBody = (name: string) => {
 *   P.inContext(Definition(name))(
 *     succeed(Function(name))
 *       .apply(arguments)
 *       .skip(symbol(P.Token("=", ExpectingEquals)))
 *       .apply(expression)
 *   )
 * }
 *
 * const definition: Parser<Expr, Problem> =
 *   definitionBody.andThen(functionName);
 * ```
 *
 * First we parse the function name, and then we parse the rest of the definition.
 * Importantly, we call `inContext` so that any dead end that occurs in
 * `definitionBody` will get this extra context information. That way you can say
 * things like, “I was expecting an equals sign in the `view` definition.” Context!
 *
 * @remarks
 * **Note:** Typescript, while powerful, is not powerfull enough to allow us to type `ctx`.
 * `Parser` is a function of type `(s: State) => PStep<A, PROBLEM>` and if we add a `CTX`
 * type parameter like so `(s: State<CTX>) => PStep<A, CTX, PROBLEM>` we have
 * `CTX` as an *argument*. This is problematic since `inContext` changes the argument of a function that
 * is *already* declared! You end up in a situation where the parser can not know
 * the type of `CTX` since that is decided by function that wrapps it.
 *
 *
 * @privateRemarks
 * We will not add this to the Parser interface since that will make `CTX` leak
 * into the Simple module.
 *
 * @category Parsers
 */
export const inContext =
  (ctx: unknown) =>
  <A, PROBLEM>(parser: Parser<A, PROBLEM>): Parser<A, PROBLEM> => {
    return new ParserImpl((s0) => {
      // This must use a immutable list!!!
      const res = parser.exec(
        changeContext(
          s0.context.push({ context: ctx, row: s0.row, col: s0.col }),
          s0
        )
      );

      if (isGood(res)) {
        return Good(res.flag, res.value, changeContext(s0.context, res.ctx));
      } else {
        return res;
      }
    });
  };

function changeContext(
  newContext: immutable.Stack<Located>,
  { context, ...rest }: State
): State {
  return {
    context: newContext,
    ...rest,
  };
}

// INDENTATION

/**
 * Just like {@link Simple!getIndent}
 *
 * @category Indentation
 */
export const getIndent = new ParserImpl<number, never>(
  (s: State): PStep<number, never> => Good(false, s.indent, s)
);

/**
 * Just like {@link Simple!withIndent}
 *
 * @category Indentation
 */
export const withIndent =
  (newIndent: number) =>
  <A, PROBLEM>(parse: Parser<A, PROBLEM>): Parser<A, PROBLEM> => {
    return new ParserImpl((s) => {
      const res = parse.exec(changeIndent(newIndent, s));
      if (isGood(res)) {
        return Good(res.flag, res.value, changeIndent(s.indent, res.ctx));
      } else {
        return res;
      }
    });
  };

function changeIndent(newIndent: number, { indent, ...rest }: State): State {
  return {
    indent: newIndent,
    ...rest,
  };
}

// SYMBOL

/**
 * TODO: Rewrite to tsdoc
 *
 * Just like {@link Simple!symbol}except you provide a `Token` to
 * clearly indicate your custom type of problems:
 *
 * ```ts
 * const comma: Parser<Context, Problem, > = symbol(Token("," ExpectingComma))
 * ```
 *
 * @category Building Blocks
 */
export const symbol = token;

// KEYWORD

/**
 Just like {@link Simple!keyword} except you provide a `Token`
 to clearly indicate your custom type of problems:

 ```ts
      const myLet = keyword(Token("let", ExpectingLet))
 ```

 Note that this would fail to chomp `letter` because of the subsequent
 characters. Use `token` if you do not want that last letter check.

 @param token - the token you want to use as a keyword
 @return a parser for that keyword

 @category Building Blocks
 */
export const keyword = <PROBLEM>(
  token: Token<PROBLEM>
): Parser<Unit, PROBLEM> => {
  const kwd = token.value;

  const progress = kwd.length > 0;

  return new ParserImpl((s) => {
    const [newOffset, newRow, newCol] = Helpers.isSubString(
      kwd,
      s.offset,
      s.row,
      s.col,
      s.src
    );

    if (
      newOffset === -1 ||
      0 <=
        Helpers.isSubChar(
          (c) => Helpers.isAlphaNum(c) || c === "_",
          newOffset,
          s.src
        )
    ) {
      return Bad(false, fromState(s, token.problem));
    } else {
      return Good(progress, Unit, {
        src: s.src,
        offset: newOffset,
        indent: s.indent,
        context: s.context,
        row: newRow,
        col: newCol,
      });
    }
  });
};

// POSITION

/**
 *  Just like {@link Simple!getPosition}
 *
 * @category Positions
 */
export const getPosition = new ParserImpl(
  (s: State): PStep<[number, number], never> => Good(false, [s.row, s.col], s)
);

/**
 * Just like {@link Simple!getRow}
 *
 * @category Positions
 */
export const getRow = new ParserImpl(
  (s: State): PStep<number, never> => Good(false, s.row, s)
);

/**
 * Just like {@link Simple!getCol}
 *
 * @category Positions
 */
export const getCol = new ParserImpl(
  (s: State): PStep<number, never> => Good(false, s.col, s)
);

/**
 * Just like {@link Simple!getOffset}
 *
 * @category Positions
 */
export const getOffset = new ParserImpl(
  (s: State): PStep<number, never> => Good(false, s.offset, s)
);

/**
 * Just like {@link Simple!getSource}
 *
 * @category Positions
 */
export const getSource = new ParserImpl(
  (s: State): PStep<string, never> => Good(false, s.src, s)
);

// VARIABLES

/**
 * Just like {@link Simple!variable} except you specify the
 * problem yourself.
 *
 * @category Building Blocks
 */
export const variable = <PROBLEM>(args: {
  start: (char: string) => boolean;
  inner: (char: string) => boolean;
  reserved: Set<string>;
  expecting: PROBLEM;
}): Parser<string, PROBLEM> => {
  return new ParserImpl((s) => {
    const firstOffset = Helpers.isSubChar(args.start, s.offset, s.src);

    if (firstOffset === -1) {
      return Bad(false, fromState(s, args.expecting));
    }

    const s1 =
      firstOffset === -2
        ? varHelp(
            args.inner,
            s.offset + 1,
            s.row + 1,
            1,
            s.src,
            s.indent,
            s.context
          )
        : varHelp(
            args.inner,
            firstOffset,
            s.row,
            s.col + 1,
            s.src,
            s.indent,
            s.context
          );
    const name = s.src.slice(s.offset, s1.offset);
    if (args.reserved.has(name)) {
      return Bad(false, fromState(s, args.expecting));
    } else {
      return Good(true, name, s1);
    }
  });
};

const varHelp = (
  isGood: (s: string) => boolean,
  offset: number,
  row: number,
  col: number,
  src: string,
  indent: number,
  context: immutable.Stack<Located>
): State => {
  let currentOffset = offset;
  let currentRow = row;
  let currentCol = col;

  while (true) {
    const newOffset = Helpers.isSubChar(isGood, currentOffset, src);
    if (newOffset === -1) {
      return {
        src: src,
        offset: currentOffset,
        indent: indent,
        context: context,
        row: currentRow,
        col: currentCol,
      };
    } else if (newOffset === -2) {
      currentOffset = currentOffset + 1;
      currentRow = currentRow + 1;
      currentCol = 1;
    } else {
      currentOffset = newOffset;
      currentCol = currentCol + 1;
    }
  }
};

// SEQUENCES

/**
 * Just like {@link Simple!sequence} except with a `Token` for
 * the start, separator, and end. That way you can specify your custom type of
 * problem for when something is not found.
 *
 * @category Loops
 * @category Sequence (All)
 */
export const sequence = <
  A,
  PROBLEM1,
  PROBLEM2,
  PROBLEM3,
  PROBLEM4,
  PROBLEM5
>(args: {
  start: Token<PROBLEM1>;
  separator: Token<PROBLEM2>;
  end: Token<PROBLEM3>;
  spaces: Parser<Unit, PROBLEM4>;
  item: Parser<A, PROBLEM5>;
  trailing: Trailing;
}): Parser<
  immutable.List<A>,
  PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4 | PROBLEM5
> => {
  return skip1st<PROBLEM1>(token(args.start))(
    skip1st(args.spaces)(
      sequenceEnd<A, PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4 | PROBLEM5>(
        token(args.end),
        args.spaces,
        args.item,
        token(args.separator),
        args.trailing
      )
    )
  );
};

/**
 * What’s the deal with trailing commas? Are they `Forbidden`?
 * Are they `Optional`? Are they `Mandatory`? Welcome to
 * {@link https://poorlydrawnlines.com/comic/shapes-club shapes club}!
 *
 * @category Sequence (All)
 */
export const Trailing = {
  Forbidden: "Forbidden",
  Optional: "Optional",
  Mandatory: "Mandatory",
} as const;

/**
 * @category Sequence (All)
 */
export type Trailing = "Forbidden" | "Optional" | "Mandatory";

const sequenceEnd = <A, PROBLEM>(
  ender: Parser<Unit, PROBLEM>,
  ws: Parser<Unit, PROBLEM>,
  parseItem: Parser<A, PROBLEM>,
  sep: Parser<Unit, PROBLEM>,
  trailing: Trailing
): Parser<immutable.List<A>, PROBLEM> => {
  const chompRest = (item: A) => {
    if (trailing === Trailing.Forbidden) {
      const res = loop(immutable.List([item]))(
        sequenceEndForbidden(ender, ws, parseItem, sep)
      );
      return res;
    } else if (trailing === Trailing.Optional) {
      const res = loop(immutable.List([item]))(
        sequenceEndOptional(ender, ws, parseItem, sep)
      );
      return res;
    } else {
      // TODO: rewrite this with infix notation
      const res = skip2nd(
        skip1st(ws)(
          skip1st(sep)(
            skip1st(ws)(
              loop(immutable.List([item]))(
                sequenceEndMandatory(ws, parseItem, sep)
              )
            )
          )
        )
      )(ender);
      return res;
    }
  };

  return oneOf(
    parseItem.andThen(chompRest),
    ender.map(() => immutable.List())
  );
};

const sequenceEndForbidden =
  <A, PROBLEM>(
    ender: Parser<Unit, PROBLEM>,
    ws: Parser<Unit, PROBLEM>,
    parseItem: Parser<A, PROBLEM>,
    sep: Parser<Unit, PROBLEM>
  ) =>
  (
    revItems: immutable.List<A>
  ): Parser<Step<immutable.List<A>, immutable.List<A>>, PROBLEM> => {
    return skip1st(ws)(
      oneOf(
        skip1st(sep)(
          skip1st(ws)(parseItem.map((item) => Loop(revItems.push(item))))
        ),
        ender.map(() => Done(revItems))
      )
    );
  };

const sequenceEndOptional =
  <A, PROBLEM>(
    ender: Parser<Unit, PROBLEM>,
    ws: Parser<Unit, PROBLEM>,
    parseItem: Parser<A, PROBLEM>,
    sep: Parser<Unit, PROBLEM>
  ) =>
  (
    revItems: immutable.List<A>
  ): Parser<Step<immutable.List<A>, immutable.List<A>>, PROBLEM> => {
    const parseEnd = ender.map(() => Done(revItems));
    return skip1st(ws)(
      oneOf(
        skip1st(sep)(
          skip1st(ws)(
            oneOf(
              parseItem.map((item) => Loop(revItems.push(item))),
              parseEnd
            )
          )
        ),
        parseEnd
      )
    );
  };

const sequenceEndMandatory =
  <A, PROBLEM>(
    ws: Parser<Unit, PROBLEM>,
    parseItem: Parser<A, PROBLEM>,
    sep: Parser<Unit, PROBLEM>
  ) =>
  (
    revItems: immutable.List<A>
  ): Parser<Step<immutable.List<A>, immutable.List<A>>, PROBLEM> => {
    return oneOf(
      skip2nd(parseItem)(skip2nd(ws)(skip2nd(sep)(ws))).map((item) =>
        Loop(revItems.push(item))
      ),
      succeed(Unit).map(() => Done(revItems))
    );
  };

// WHITESPACE

/**
 * Just like {@link Simple!spaces}
 *
 * @category Whitespace
 */
export const spaces = new ParserImpl<Unit, never>((s: State) =>
  chompWhile((c) => c === " " || c === "\n" || c === "\r").exec(s)
);

// LINE COMMENT

/**
 * Just like {@link Simple!lineComment} except you provide a
 * `Token` describing the starting symbol.
 *
 * @category Whitespace
 */
export const lineComment = <PROBLEM>(
  start: Token<PROBLEM>
): Parser<Unit, PROBLEM> =>
  skip2nd<Unit, PROBLEM>(token(start))(chompUntilEndOr("\n"));

// Multiline Comment

/**
 * Help distinguish between unnestable  `/*` `* /` comments like in JS and nestable `{-` `-}`
 * comments like in Elm. \u002A
 *
 * **NOTE**: the extra space in `* /` is because I couldn't figure out how to escape it.
 *
 * @category Multiline Comment (All)
 */
export const Nestable = {
  Nestable: "Nestable",
  NotNestable: "NotNestable",
} as const;

/**
 * @category Multiline Comment (All)
 */
export type Nestable = "Nestable" | "NotNestable";

/**
 *
 * @param x - the value you want to check
 * @returns whether or not it is a Nestable
 *
 * @category Multiline Comment (All)
 */
export function isNestable(x: any): x is typeof Nestable.Nestable {
  return x === Nestable.Nestable;
}

/**
 *
 * @param x - the value you want to check
 * @returns whether or not it is a NotNestable
 *
 * @category Multiline Comment (All)
 */
export function isNotNestable(x: any): x is typeof Nestable.NotNestable {
  return x === Nestable.NotNestable;
}

/**
 * Just like {@link Simple!multiComment} except with a
 * `Token` for the open and close symbols.
 *
 * @category Whitespace
 * @category Multiline Comment (All)
 */
export const multiComment =
  <PROBLEM>(open: Token<PROBLEM>) =>
  (close: Token<PROBLEM>) =>
  (nestable: Nestable): Parser<Unit, PROBLEM> => {
    if (isNotNestable(nestable)) {
      return skip2nd(token(open))(chompUntil(close));
    } else {
      return nestableComment<PROBLEM>(open, close);
    }
  };

function nestableComment<PROBELM>(
  open: Token<PROBELM>,
  close: Token<PROBELM>
): Parser<Unit, PROBELM> {
  const openChar = open.value.at(0);
  const closeChar = close.value.at(0);
  if (openChar === undefined) {
    return problem(open.problem);
  }
  if (closeChar === undefined) {
    return problem(close.problem);
  }

  const isNotRelevant = (char: string) => char != openChar && char != closeChar;

  const chompOpen = token(open);

  return skip2nd(chompOpen)(
    nestableHelp(isNotRelevant, token(open), token(close), close.problem, 1)
  );
}

function nestableHelp<PROBLEM>(
  isNotRelevant: (c: string) => boolean,
  open: Parser<Unit, PROBLEM>,
  close: Parser<Unit, PROBLEM>,
  expectingClose: PROBLEM,
  nestLevel: number
): Parser<Unit, PROBLEM> {
  return skip1st(chompWhile(isNotRelevant))(
    oneOf(
      nestLevel === 1
        ? close
        : close.andThen(() =>
            nestableHelp(
              isNotRelevant,
              open,
              close,
              expectingClose,
              nestLevel - 1
            )
          ),
      open.andThen(() =>
        nestableHelp(isNotRelevant, open, close, expectingClose, nestLevel + 1)
      ),
      chompIf(() => true)(expectingClose).andThen(() =>
        nestableHelp(isNotRelevant, open, close, expectingClose, nestLevel)
      )
    )
  );
}
