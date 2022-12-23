import * as immutable from "immutable";
import * as Results from "./Result.js";

// Located

/**
 * The location and context of an error.
 *
 * **Note:** Rows and columns are counted like a text editor. The beginning is `row=1`
 * and `col=1`. The `col` increments as characters are chomped. When a `\n` is chomped,
 * `row` is incremented and `col` starts over again at `1`.
 *
 * @remark
 *
 * Note that the `context` is actually untyped! This was a contious decision to
 * help improve type inference. Use the {@link getContext} function to retreive
 * the context witht he appropriate type!
 *
 * @see
 *
 * - {@link DeadEnd}
 * - {@link run}
 * - {@link inContext}
 * - {@link getContext}
 *
 * @category Parsers
 */
export type Located<CTX> = {
  row: number;
  col: number;
  // NOTE: this must be unknown, we recover type information in the run(...) function
  context: unknown;
};

/**
 * After you have {@link run} you parser, if there is a problem you can recover
 * the *context and its type* with this function.
 *
 * @see
 * - {@link Located}
 *
 * @category Parsers
 */
export function getContext<CTX>(located: Located<CTX>): CTX {
  return located.context as CTX;
}

// State

/**
 *
 *
 *
 * @privateRemarks
 * TODO: Can you make it polymorphic over the `src` type?
 * Then you might be able to write parsers for bytestrings and other stringlike
 * objects
 */
export type State<CTX> = {
  src: string;
  offset: number; //in BYTES (some UTF-16 characters are TWO bytes)
  indent: number;
  context: immutable.Stack<Located<CTX>>;
  row: number; //in newlines
  col: number; //in UTF-16 characters
};

// PROBLEMS

/**
 * When we reach a deadend we return all the information you need to create great
 * error message.
 *
 * @example
 *
 * Say you are parsing a function named `viewHealthData` that contains a list.
 * You might get a `DeadEnd` like this:
 *
 * ```ts
 * { row : 18
 * , col : 22
 * , problem : "UnexpectedComma"
 * , contextStack :
 *     [ { row : 14
 *       , col : 1
 *       , context : "ViewHealthData"
 *      }
 *     , { row : 15
 *       , col : 4
 *       , context : "List"
 *       }
 *     ]
 * }
 * ```
 *
 * We have a ton of information here! So in the error message, we can say that “I
 * ran into an issue when parsing a `list` in the definition of `viewHealthData`. It
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
 * @see
 *
 * - {@link Located}
 * - {@link Deadend!function}
 *
 * @category Parsers
 * @category DeadEnd (All)
 */
export type DeadEnd<CTX, PROBLEM> = {
  row: number;
  col: number;
  problem: PROBLEM;
  contextStack: immutable.Stack<Located<CTX>>;
};

/**
 * A function to create a `DeadEnd`
 *
 * @category DeadEnd (All)
 */
export function Deadend<CTX, PROBLEM>(
  row: number,
  col: number,
  problem: PROBLEM,
  contextStack: immutable.Stack<Located<CTX>>
): DeadEnd<CTX, PROBLEM> {
  return {
    row,
    col,
    problem,
    contextStack,
  };
}

/**
 * Keeps track of the context and problem.
 */
export type Bag<CTX, PROBLEM> =
  | Empty
  | AddRight<CTX, PROBLEM>
  | Append<CTX, PROBLEM>;

// Empty

export type Empty = typeof Empty;

export const Empty = {
  kind: "Empty",
} as const;

export function isEmpty(bag: Bag<any, any>): bag is Empty {
  return bag.kind === "Empty";
}

// AddRight

export type AddRight<CTX, PROBLEM> = {
  kind: "AddRight";
  bag: Bag<CTX, PROBLEM>;
  deadEnd: DeadEnd<CTX, PROBLEM>;
};

export function AddRight<CTX, PROBLEM>(
  bag: Bag<CTX, PROBLEM>,
  deadEnd: DeadEnd<CTX, PROBLEM>
): AddRight<CTX, PROBLEM> {
  return {
    kind: "AddRight",
    bag: bag,
    deadEnd: deadEnd,
  };
}

export function isAddRight<CTX, PROBLEM>(
  bag: Bag<CTX, PROBLEM>
): bag is AddRight<CTX, PROBLEM> {
  return bag.kind === "AddRight";
}

// Append

export type Append<CTX, PROBLEM> = {
  kind: "Append";
  left: Bag<CTX, PROBLEM>;
  right: Bag<CTX, PROBLEM>;
};

export function Append<CTX, PROBLEM>(
  left: Bag<CTX, PROBLEM>,
  right: Bag<CTX, PROBLEM>
): Append<CTX, PROBLEM> {
  return {
    kind: "Append",
    left: left,
    right: right,
  };
}

export function isAppend<CTX, PROBLEM>(
  bag: Bag<CTX, PROBLEM>
): bag is Append<CTX, PROBLEM> {
  return bag.kind === "Append";
}

// Bag transforms

export function fromState<CTX, PROBLEM>(
  state: State<CTX>,
  p: PROBLEM
): Bag<CTX, PROBLEM> {
  return AddRight(
    Empty,
    Deadend(
      state.row,
      state.col,
      p,
      state.context as immutable.Stack<Located<CTX>>
    )
  );
}

export function fromInfo<CTX, PROBLEM>(
  row: number,
  col: number,
  p: PROBLEM,
  context: immutable.Stack<{ row: number; col: number; context: CTX }>
): Bag<CTX, PROBLEM> {
  return AddRight(Empty, Deadend(row, col, p, context));
}

export function bagToList<CTX, PROBLEM>(
  bag: Bag<CTX, PROBLEM>
): DeadEnd<CTX, PROBLEM>[] {
  const workList = [bag];
  const list: DeadEnd<CTX, PROBLEM>[] = [];

  while (workList.length > 0) {
    const currentBag: Bag<CTX, PROBLEM> = workList.pop() as any;
    if (isAddRight(currentBag)) {
      list.push(currentBag.deadEnd);
      workList.push(currentBag.bag);
    } else if (isAppend(currentBag)) {
      // Note that the order of these statements are important to the
      // final order of the list
      workList.push(currentBag.left);
      workList.push(currentBag.right);
    }
    // Ignore Empty bags
  }

  return list.reverse();
}

// PStep

export type PStep<A, CTX, PROBLEM> = Good<A, CTX> | Bad<CTX, PROBLEM>;

export type Good<A, CTX> = {
  kind: "Good";
  flag: boolean; // if true, reached an unrecoverable error
  value: A;
  ctx: State<CTX>;
};

export function Good<A, CTX>(
  flag: boolean, // if true, reached an end state
  value: A,
  ctx: State<CTX>
): Good<A, CTX> {
  return {
    kind: "Good",
    flag,
    value,
    ctx,
  };
}

export function isGood<A, CTX>(x: PStep<A, CTX, any>): x is Good<A, CTX> {
  return typeof x === "object" && x.kind === "Good";
}

/**
 * When something bad happens we return this.
 *
 * flag - TODO
 * bag - TODO
 *
 * @see
 * - {@link Bad:function Bad constructor}
 * - {@link isBad:function}
 */
export type Bad<CTX, PROBLEM> = {
  kind: "Bad";
  flag: boolean; // if true, reached an end state
  bag: Bag<CTX, PROBLEM>;
};

/**
 * Constructor for {@link Bad:type}.
 *
 * @see
 * - {@link Bad:type Bad type}
 * - {@link isBad:function}
 */
export function Bad<CTX, PROBLEM>(
  flag: boolean,
  bag: Bag<CTX, PROBLEM>
): Bad<CTX, PROBLEM> {
  return {
    kind: "Bad",
    flag,
    bag,
  };
}

/**
 * Type guard for {@link Bad:type}.
 *
 * @see
 * - {@link Bad:type Bad type}
 * - {@link Bad:function Bad constructor}
 */
export function isBad<CTX, PROBLEM>(
  x: PStep<any, CTX, PROBLEM>
): x is Bad<CTX, PROBLEM> {
  return typeof x === "object" && x.kind === "Bad";
}

/**
 * If the type is a function, returns the argument of the function, otherwise it
 * returns a type error
 *
 * @remarks
 * Used to provide proper typing for {@link Parser.apply}.
 *
 * @see
 * - {@link Parser.apply}
 * - {@link GetReturnType}
 *
 * @category Helper Types
 */
export type GetArgumentType<Function> = Function extends (arg: infer A) => any
  ? A
  : "Error: The left hand side must be function";

/**
 * If the type is a function, returns the return type of the function, otherwise it
 * returns a type error
 *
 * @remarks
 * Used to provide proper typing for {@link Parser.apply}.
 *
 * @see
 * - {@link Parser.apply}
 * - {@link GetArgumentType}
 *
 * @category Helper Types
 */
export type GetReturnType<Function> = Function extends (arg: any) => any
  ? ReturnType<Function>
  : "Error: The left hand side must be a function";

/**
 * An advanced Parser gives two ways to improve your error messages:
 *
 * - `problem` — Instead of all errors being a `string`, you can create a custom type like type `type Problem = BadIndent | BadKeyword ` and track problems much more precisely.
 * - `context` — Error messages can be further improved when precise problems are paired with information about where you ran into trouble. By tracking the context, instead of saying “I found a bad keyword” you can say “I found a bad keyword when parsing a list” and give folks a better idea of what the parser thinks it is doing.
 *
 * I recommend starting with the simpler {@link Simple | Parser} module, and when you feel
 * comfortable and want better error messages, you can create a type alias like this:
 *
 * ```ts
 * import * as Advanced from "@honungsburk/kombo/Advanced"
 *
 * type Context = {kind: "Definition", value: string } | { kind: "List" } | {kind : "Record" }
 *
 * type Problem = {kind: "BadIndent" } | {kind: "BadKeyword", value: string}
 *
 * type MyParser<A> = Advanced.Parser<A, Problem>
 * ```
 *
 * @remarks
 *
 * Note that `context` isn't typed. I could not figure out how to both have it
 * typed and get good type inference.
 *
 * @privateRemarks
 * To be able to provide infix notation I've wrapped the underlying parser
 * function in a class.
 *
 * @typeParam A       - Success Value
 * @typeParam PROBLEM - When the parser fails it returns a problem
 *
 * @category Parsers
 */
export interface Parser<A, CTX, PROBLEM> {
  /**
   * **WARNING:** Do not use directly, it is used by the library
   *
   * @private
   * @internal
   */
  exec: (s: State<unknown>) => PStep<A, CTX, PROBLEM>;

  /**
   * Transform the result of a parser.
   *
   * @example
   * Maybe you have a value that is an integer or `null`:
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
   * @see
   * - The infix version of {@link Simple!map}
   *
   * @category Mapping
   */
  map<B>(fn: (v: A) => B): Parser<B, CTX, PROBLEM>;

  /**
   *
   *
   * Parse one thing `andThen` parse another thing. This is useful when you want
   * to check on what you just parsed.
   *
   * @example
   * Maybe you want U.S. zip codes
   * and `int` is not suitable because it does not allow leading zeros. You could
   * say:
   *
   * ```ts
   * const checkZipCode = (code: string): Parser<string> => {
   *   if (code.length === 5) {
   *     return succeed(code);
   *   } else {
   *     return problem("a U.S. zip code has exactly 5 digits");
   *   }
   * };
   *
   * const zipCode: Parser<string> = chompWhile(Helpers.isDigit)
   *   .getChompedString()
   *   .andThen(checkZipCode);
   *
   *```
   *
   * First we chomp digits `andThen` we check if it is a valid U.S. zip code. We
   * `succeed` if it has exactly five digits and report a `problem` if not.
   *
   *
   * **Note:** If you are using `andThen` recursively and blowing the stack, check
   * out the {@link loop} function to limit stack usage.
   *
   * @see
   * - The infix version of {@link Simple!andThen}
   *
   * @category Mapping
   */
  andThen<B, CTX2, PROBLEM2>(
    fn: (v: A) => Parser<B, CTX2, PROBLEM2>
  ): Parser<B, CTX | CTX2, PROBLEM | PROBLEM2>;

  /**
   * Skip the return value of the parser on the right hand side.
   *
   * @example
   *
   * ```ts
   *  const integer =
   *    succeed(n => n)
   *      .skip(spaces)
   *      .apply(int)
   *      .skip(spaces)
   * ```
   *
   * @see
   * - The infix version of {@link Simple!skip2nd}
   *
   * @category Mapping
   */
  skip<CTX2, PROBLEM2>(
    other: Parser<unknown, CTX2, PROBLEM2>
  ): Parser<A, CTX | CTX2, PROBLEM | PROBLEM2>;

  /**
   * Keep the return value of the parser it is given, and ignore the previous value.
   *
   * @remarks
   * Just a shorthand for `yourParser.andThen(() => ...)`
   *
   * @example
   *
   * Maybe you want to first skip some whitespace and then grab an int.
   *
   * ```ts
   * const whitespaceThenInt: Parser<number> = spaces.keep(int)
   * ```
   *
   * @category Mapping
   */
  keep<B, CTX2, PROBLEM2>(
    other: Parser<B, CTX2, PROBLEM2>
  ): Parser<B, CTX | CTX2, PROBLEM | PROBLEM2>;

  /**
   * Apply values to a function in a parser pipeline.
   *
   * @example
   *
   * If we want to parse some kind of `Point` type we could say:
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
   * // A parser pipeline
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
   * **NOTE:** You can only use `.apply(...)` on a parser that contains a
   * function that is *curried*.
   *
   * @see
   *
   * - Infix version of {@link apply}.
   * - {@link https://en.wikipedia.org/wiki/Currying | Currying } as defined by wikipedia
   *
   * @category Mapping
   */
  apply<CTX2, PROBLEM2>(
    parser: Parser<GetArgumentType<A>, CTX2, PROBLEM2>
  ): Parser<GetReturnType<A>, CTX | CTX2, PROBLEM | PROBLEM2>;

  /**
   * Just like {@link Simple!oneOf | Simple.oneOf} but only between **two** parsers.
   *
   * @remarks
   * **NOTE:** The left side is checked first!
   *
   * @see
   * - {@link Simple!oneOf}
   *
   * @category Branches
   */
  or<B, CTX2, PROBLEM2>(
    other: Parser<B, CTX2, PROBLEM2>
  ): Parser<A | B, CTX | CTX2, PROBLEM | PROBLEM2>;

  /**
   * Just like {@link Simple!run | Simple.run}
   *
   * @category Parsers
   */
  run(src: string): Results.Result<A, DeadEnd<CTX, PROBLEM>[]>;

  /**
   * Just like {@link Simple!backtrackable | Simple.backtrackable}
   *
   * @category Branches
   */
  backtrackable(): Parser<A, CTX, PROBLEM>;

  /**
   * Just like {@link Simple!getChompedString | Simple.getChompedString}
   *
   * @category Chompers
   */
  getChompedString(): Parser<string, CTX, PROBLEM>;

  /**
   * Just like {@link Simple!mapChompedString | Simple.mapChompedString}
   *
   * @category Chompers
   */
  mapChompedString<B>(fn: (s: string, v: A) => B): Parser<B, CTX, PROBLEM>;

  /**
   * Just like {@link Simple!getIndent | Simple.getIndent}
   *
   * @example
   * Writing `yourParser.getIndent()` is the same as `yourParser.keep(getIndent)`
   *
   * @category Indentation
   */
  getIndent(): Parser<number, CTX, PROBLEM>;

  /**
   * Just like {@link Simple!withIndent | Simple.withIndent}
   *
   * @example
   *
   * **Note:** `withIndent` sets the indentation for all *previous* uses of `getIndent`
   *
   * ```ts
   * const parser = succeed(Unit).withIndent(3).getIndent();
   * run(parser)(""); // => 1
   *
   * const parser2 = succeed(Unit).getIndent().withIndent(3);
   * run(parser2)(""); // => 3
   * ```
   *
   * This might at first look seem strange, but a good way to think about it is
   * that our parser is a tree like structure
   *
   *  withindent(4)___withindent(4)___ parser3
   *               |               |
   *               |               |__ parser4
   *               |
   *               |__parser2 ___ parser5
   *                          |
   *                          |__ parser6
   *                          |
   *                          |__ parser7
   *
   * where `withIndent` only applies to its *subtrees*!
   *
   * @category Indentation
   */
  withIndent(newIndent: number): Parser<A, CTX, PROBLEM>;

  /**
   *  Just like {@link Simple!getPosition | Simple.getPosition}
   *
   * @category Positions
   */
  getPosition(): Parser<[number, number], CTX, PROBLEM>;

  /**
   * Just like {@link Simple!getRow | Simple.getRow}
   *
   * @category Positions
   */
  getRow(): Parser<number, CTX, PROBLEM>;

  /**
   * Just like {@link Simple!getCol  | Simple.getCol}
   * @category Positions
   */
  getCol(): Parser<number, CTX, PROBLEM>;

  /**
   * Just like {@link Simple!getOffset}
   *
   * @category Positions
   */
  getOffset(): Parser<number, CTX, PROBLEM>;

  /**
   * Just like {@link Simple!getSource}
   *
   * @category Positions
   */
  getSource(): Parser<string, CTX, PROBLEM>;
}
