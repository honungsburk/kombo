// Imports
import Immutable from "immutable";
import * as Results from "ts-results-es";
import * as A from "./Advanced.js";

// Exports
export {
  Loop,
  Done,
  Unit,
  Nestable,
  isNotNestable,
  isNestable,
  Trailing,
} from "./Advanced.js";

// PARSERS

/**
 * A `Parser` helps turn a `string` into nicely structured data. For example,
 * we can {@link run} the {@link int} parser to turn a `string` into a `number`:
 *
 *  ```ts
 *   run(int)("123456") // => Ok 123456
 *   run(int)("3.1415") // => Err ...
 *  ```
 *
 * The cool thing is that you can combine `Parser` values to handle much more
 * complex scenarios.
 *
 * @category Parsers
 */
export type Parser<A> = A.Parser<A, Problem>;

// RUN

/**
 * Try a parser. Here are some examples using the {@link keyword}
 * parser:
 *
 * ```ts
 *   run(keyword("true"))("true")  // => Ok ()
 *   run(keyword("true"))("True")  // => Err ...
 *   run(keyword("true"))("false") // => Err ...
 *   run(keyword("true"))("true!") // => Ok ()
 * ```
 *
 * Notice the last case! A `Parser` will chomp as much as possible and not worry
 * about the rest. Use the {@link end} parser to ensure you made it to the end
 * of the string!
 *
 * @category Parsers
 */
export const run =
  <A>(parser: Parser<A>) =>
  (src: string): Results.Result<A, DeadEnd[]> => {
    const res = A.run(parser)(src);
    if (res.err) {
      return new Results.Err(
        res.val.map((p) => ({ row: p.row, col: p.col, problem: p.problem }))
      );
    }

    return res;
  };

// PROBLEMS

/**
 * A parser can run into situations where there is no way to make progress.
 * When that happens, I record the `row` and `col` where you got stuck and the
 * particular `problem` you ran into. That is a `DeadEnd`!
 *
 * **Note:** I count rows and columns like a text editor. The beginning is `row=1`
 * and `col=1`. As I chomp characters, the `col` increments. When I reach a `\n`
 * character, I increment the `row` and set `col=1`.
 *
 * @category Errors
 */
export type DeadEnd = {
  row: number;
  col: number;
  problem: Problem;
};

/**
 * Turn all the {@link DeadEnd} data into a string that is easier for people to read.
 *
 * @remark
 * **Note:** This is just a baseline of quality. It cannot do anything with
 * colors. It is not interactivite. It just turns the raw data into strings.
 * I really hope folks will check out the source code for some inspiration on
 * how to turn errors into Html with nice colors and interaction! The
 * Parser.Advanced module lets you work with context as well, which really
 * unlocks another level of quality! The "context" technique is how the Elm
 * compiler can say "I think I am parsing a list, so I was expecting a closing ] here."
 * Telling users what the parser thinks is happening can be really helpful!
 *
 * @category Errors
 */
export function deadEndsToString(deadEnds: DeadEnd[]): string {
  return "TODO";
}

/**
 * When you run into a `DeadEnd`, I record some information about why you
 * got stuck. This data is useful for producing helpful error messages. This is
 * how {@link problemToString} works!
 *
 * **Note:** If you feel limited by this type (i.e. having to represent custom
 * problems as strings) I highly recommend switching to `Parser.Advanced`. It
 * lets you define your own `Problem` type. It can also track "context" which
 * can improve error messages a ton! This is how the Elm compiler produces
 * relatively nice parse errors, and I am excited to see those techniques applied
 * elsewhere!
 *
 * @category Problem (All)
 * @category Errors
 */
export type Problem =
  | Expecting
  | ExpectingBinary
  | ExpectingHex
  | ExpectingOctal
  | ExpectingInt
  | ExpectingFloat
  | ExpectingNumber
  | ExpectingVariable
  | ExpectingSymbol
  | ExpectingKeyword
  | ExpectingEnd
  | UnexpectedChar
  | Generic
  | BadRepeat;

/**
 * A very basic `toString` function for {@link Problem}. You probably want to
 * implement your own!
 *
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 * @category Errors
 */
export function problemToString(problem: Problem): string {
  if (isProblemWithStr(problem)) {
    return `${problem.kind}: '${problem.str}'`;
  } else {
    return problem.kind;
  }
}

/**
 * returns true for any problem that has an extra `str` value.
 *
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 * @category Errors
 */
export function isProblemWithStr(
  problem: any
): problem is Expecting | ExpectingSymbol | ExpectingKeyword | Generic {
  return (
    isExpecting(problem) ||
    isExpectingSymbol(problem) ||
    isExpectingKeyword(problem) ||
    isGeneric(problem)
  );
}

// Expecting

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type Expecting = {
  readonly kind: "Expecting";
  readonly str: string;
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const Expecting = (str: string): Expecting => ({
  kind: "Expecting",
  str: str,
});

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpecting(x: any): x is Expecting {
  return typeof x === "object" && x.kind === "Expecting";
}

// ExpectingBinary

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingBinary = {
  readonly kind: "ExpectingBinary";
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingBinary: ExpectingBinary = {
  kind: "ExpectingBinary",
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingBinary(x: any): x is ExpectingBinary {
  return typeof x === "object" && x.kind === "ExpectingBinary";
}

// ExpectingOctal

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingOctal = {
  readonly kind: "ExpectingOctal";
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingOctal: ExpectingOctal = {
  kind: "ExpectingOctal",
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingOctal(x: any): x is ExpectingOctal {
  return typeof x === "object" && x.kind === "ExpectingOctal";
}

// ExpectingHex

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingHex = {
  readonly kind: "ExpectingHex";
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingHex: ExpectingHex = {
  kind: "ExpectingHex",
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingHex(x: any): x is ExpectingHex {
  return typeof x === "object" && x.kind === "ExpectingHex";
}

// ExpectingInt

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingInt = {
  readonly kind: "ExpectingInt";
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingInt: ExpectingInt = {
  kind: "ExpectingInt",
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingInt(x: any): x is ExpectingInt {
  return typeof x === "object" && x.kind === "ExpectingInt";
}

// ExpectingFloat

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingFloat = {
  readonly kind: "ExpectingFloat";
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingFloat: ExpectingFloat = {
  kind: "ExpectingFloat",
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingFloat(x: any): x is ExpectingFloat {
  return typeof x === "object" && x.kind === "ExpectingFloat";
}

// ExpectingBinary

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingNumber = {
  readonly kind: "ExpectingNumber";
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingNumber: ExpectingNumber = {
  kind: "ExpectingNumber",
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingNumber(x: any): x is ExpectingNumber {
  return typeof x === "object" && x.kind === "ExpectingNumber";
}

// ExpectingVariable

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingVariable = {
  readonly kind: "ExpectingVariable";
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingVariable: ExpectingVariable = {
  kind: "ExpectingVariable",
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingVariable(x: any): x is ExpectingVariable {
  return typeof x === "object" && x.kind === "ExpectingVariable";
}

// ExpectingSymbol

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingSymbol = {
  readonly kind: "ExpectingSymbol";
  readonly str: string;
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingSymbol = (str: string): ExpectingSymbol => ({
  kind: "ExpectingSymbol",
  str: str,
});

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingSymbol(x: any): x is ExpectingSymbol {
  return typeof x === "object" && x.kind === "ExpectingSymbol";
}

// ExpectingKeyword

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingKeyword = {
  readonly kind: "ExpectingKeyword";
  readonly str: string;
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingKeyword = (str: string): ExpectingKeyword => ({
  kind: "ExpectingKeyword",
  str: str,
});

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingKeyword(x: any): x is ExpectingKeyword {
  return typeof x === "object" && x.kind === "ExpectingKeyword";
}

// ExpectingEnd

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type ExpectingEnd = {
  readonly kind: "ExpectingEnd";
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const ExpectingEnd: ExpectingEnd = {
  kind: "ExpectingEnd",
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isExpectingEnd(x: any): x is ExpectingEnd {
  return typeof x === "object" && x.kind === "ExpectingEnd";
}

// UnexpectedChar

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type UnexpectedChar = {
  readonly kind: "UnexpectedChar";
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const UnexpectedChar: UnexpectedChar = {
  kind: "UnexpectedChar",
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isUnexpectedChar(x: any): x is UnexpectedChar {
  return typeof x === "object" && x.kind === "UnexpectedChar";
}

// Generic

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export type Generic = {
  readonly kind: "Generic";
  readonly str: string;
};

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export const Generic = (str: string): Generic => ({
  kind: "Generic",
  str: str,
});

/**
 * @see
 * - {@link Problem}
 *
 * @category Problem (All)
 */
export function isGeneric(x: any): x is Generic {
  return typeof x === "object" && x.kind === "Generic";
}

// BadRepeat

/**
 * @category BadRepeat
 * @category Problem (All)
 */
export type BadRepeat = {
  readonly kind: "BadRepeat";
};

/**
 * @category BadRepeat
 * @category Problem (All)
 */
export const BadRepeat: BadRepeat = {
  kind: "BadRepeat",
};

/**
 * @category BadRepeat
 * @category Problem (All)
 */
export function isBadRepeat(x: any): x is BadRepeat {
  return typeof x === "object" && x.kind === "BadRepeat";
}

// PRIMITIVES

/**
 * A parser that succeeds without chomping any characters.
 *
 * ```ts
 *   run(succeed(90210    ))("mississippi") // => Ok(90210)
 *   run(succeed(3.141    ))("mississippi") // => Ok(3.141)
 *   run(succeed(true     ))("mississippi") // => Ok(true)
 *   run(succeed(undefined))("mississippi") // => Ok(undefined)
 * ```
 *
 * Seems weird on its own, but it is very useful in combination with other
 * functions. The docs for {@link Advanced!Parser.apply} and {@link Advanced!Parser.andThen} have some neat
 * examples.
 *
 * ```ts
 * const parser = succeed("I always succeed!")
 * run(parser)("doesn't matter") // => Ok("I always succeed!")
 * ```
 *
 * @see
 * - {@link problem}
 *
 * @category Primitives
 */
export function succeed<A>(v: A): Parser<A> {
  return A.succeed(v);
}

/**
 * Indicate that a parser has reached a dead end. "Everything was going fine
 * until I ran into this problem." Check out the {@link Advanced!Parser.andThen} docs to see
 * an example usage.
 *
 * ```ts
 * const parser = problem("I always fail!")
 * run(parser)("doesn't matter") // => Err {... "I always fail!" ...}
 * ```
 *
 * @see
 * - {@link succeed}
 *
 * @category Primitives
 */
export function problem<A>(msg: string): Parser<A> {
  return A.problem(Generic(msg));
}

// MAPPING

/**
 * This is a curried version of the {@link Advanced!Parser.map} method on the {@link Advanced!Parser} interface.
 *
 * ```ts
 * const parser = success(89).map(n => n + 1)
 * run(parser)("doesn't matter") // => Ok(90)
 * ```
 *
 * @category Mapping
 */
export const map =
  <A, B>(fn: (a: A) => B) =>
  (parser: Parser<A>): Parser<B> => {
    return A.map(fn)(parser);
  };

/**
 *
 * Combine the results from two different parsers.
 *
 * @example
 * The {@link apply} function is defined using {@link map2}.
 *
 * ```ts
 * const apply = map2((fn: (a: A) => B, arg: A) => fn(arg))
 * ```
 *
 *
 * @category Mapping
 */
export const map2 =
  <A, B, C>(fn: (a: A, b: B) => C) =>
  (parserA: Parser<A>) =>
  (parserB: Parser<B>): Parser<C> => {
    return A.map2(fn)(parserA)(parserB);
  };

/**
 * This is a curried version of the {@link Advanced!Parser.apply} method on the Parser interface.
 *
 * ```ts
 * const parser = apply(success(n => { int: n }))(int)
 *
 * run(parser)("123")  // => Ok({ int: 123)})
 * ```
 *
 * @category Mapping
 */
export const apply =
  <A, B>(parseFunc: Parser<(a: A) => B>) =>
  (parseArg: Parser<A>): Parser<B> => {
    return A.apply(parseFunc)(parseArg);
  };

/**
 * Run two parsers in sucession, only keeping the result of the second one.
 *
 * ```ts
 * run(skip1st(spaces)(int))("   123")  // => Ok(123)
 * run(int)("   123")                   // => Err(...)
 * ```
 *
 * @See
 * - {@link Advanced!Parser.keep } is the infix version of `skip1st`.
 * - {@link skip2nd } for a function that skips it's second argument.
 *
 * @category Mapping
 */
export const skip1st =
  (first: Parser<unknown>) =>
  <KEEP>(second: Parser<KEEP>): Parser<KEEP> => {
    return A.skip1st(first)(second);
  };

/**
 * A curried version of the {@link Parser.skip } method on the Parser class.
 *
 * ```ts
 * run(skip2nd(spaces)(int))("   123")  // => Ok(Unit)
 * run(int)("   123")                   // => Err(...)
 * ```
 *
 * **Note:** that `spaces` returns `Unit`! Unit is defined as `const Unit = false`
 *
 * @See {@link skip1st } for a function that skips it's first argument.
 *
 * @category Mapping
 */
export const skip2nd =
  <KEEP>(keepParser: Parser<KEEP>) =>
  (ignoreParser: Parser<unknown>): Parser<KEEP> => {
    return A.skip2nd(keepParser)(ignoreParser);
  };

// AND THEN

/**
 * A curried version of the {@link Advanced!Parser.andThen } method on the Parser interface.
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
 * const zipCode: Parser<string> =
 *  andThen(checkZipCode)(chompWhile(Helpers.isDigit).getChompedString())
 *
 * ```
 *
 * @category Mapping
 */
export const andThen =
  <A, B>(fn: (a: A) => Parser<B>) =>
  (p: Parser<A>): Parser<B> => {
    return A.andThen(fn)(p);
  };

// LAZY

/**
 *   Helper to define recursive parsers. Say we want a parser for simple
 *   boolean expressions:
 *
 *   ```ts
 *       "true"
 *       "false"
 *       "(true || false)"
 *       "(true || (true || false))"
 *   ```
 *
 *   Notice that a boolean expression might contain *other* boolean expressions.
 *   That means we will want to define our parser in terms of itself:
 *
 *   ```ts
 *       type MyBoolean = typeof MyTrue | typeof MyFalse | MyOr;
 *
 *       const MyTrue = {
 *         kind: "MyTrue",
 *       } as const;
 *
 *       const MyFalse = {
 *         kind: "MyFalse",
 *       } as const;
 *
 *       type MyOr = {
 *         readonly kind: "MyOr";
 *         readonly l: MyBoolean;
 *         readonly r: MyBoolean;
 *       };
 *
 *       const MyOr =
 *         (l: MyBoolean) =>
 *         (r: MyBoolean): MyOr => ({
 *           kind: "MyOr",
 *           l,
 *           r,
 *         });
 *
 *       const boolean: P.Parser<MyBoolean> = P.oneOf<MyBoolean>(
 *         P.succeed(MyTrue).skip(P.keyword("true")),
 *         P.succeed(MyFalse).skip(P.keyword("false")),
 *         P.succeed(MyOr)
 *           .skip(P.symbol("("))
 *           .skip(P.spaces)
 *           .apply(P.lazy(() => boolean))
 *           .skip(spaces)
 *           .skip(symbol("||"))
 *           .skip(spaces)
 *           .apply(P.lazy(() => boolean))
 *           .skip(P.spaces)
 *           .skip(P.symbol(")"))
 *       );
 *  ```
 *
 *  **Notice that `boolean` uses `boolean` in its definition!** In Typescript, you can
 *  only define a value in terms of itself it is behind a function call. So
 *  `lazy` helps us define these self-referential parsers. (`andThen` can be used
 *  for this as well!)
 *
 *  @category Helpers
 */
export const lazy = <A>(thunk: () => Parser<A>): Parser<A> => {
  return A.lazy(thunk);
};

// ONE OF

//
// More advanced typechecking.
//

/**
 * If you are parsing JSON, the values can be strings, floats, booleans,
 * arrays, objects, or null. You need a way to pick `oneOf` them! Here is a
 * sample of what that code might look like:
 *
 * @example
 * ```ts
 * type Json =
 *    | ReturnType<typeof JNumber>
 *    | ReturnType<typeof JBoolean>
 *    | typeof JNull;
 *
 * const JNumber = (n: number) =>
 *  ({
 *     kind: "JNumber",
 *     value: n,
 *   } as const);
 *
 * const JBoolean = (b: boolean) =>
 *   ({
 *     kind: "JBoolean",
 *     value: b,
 *   } as const);
 *
 * const JNull = {
 *   kind: "JNull",
 * } as const;
 *
 * const json: Parser<Json> = P.oneOf(
 *   P.float.map(JNumber),
 *   P.keyword("true").map(() => JBoolean(true)),
 *   P.keyword("false").map(() => JBoolean(false)),
 *   P.keyword("null").map(() => JNull)
 * );
 * ```
 *
 * @remark
 * Ignore the type signature at the top of this page. It is showing the first
 * of several overloaded definitions. Instead, think of it as having the type
 * signature `oneOf<A>(...parsers: Parser<A>[]): Parser<A>`
 *
 * @see
 * - {@link oneOfMany} like `oneOf` but with different type inference.
 *
 * @category Branches
 */
export function oneOf<A>(one: Parser<A>): Parser<A>;

export function oneOf<A, B>(one: Parser<A>, two: Parser<B>): Parser<A | B>;

export function oneOf<A, B, C>(
  one: Parser<A>,
  two: Parser<B>,
  three: Parser<C>
): Parser<A | B | C>;

export function oneOf<A, B, C, D>(
  one: Parser<A>,
  two: Parser<B>,
  three: Parser<C>,
  four: Parser<D>
): Parser<A | B | C | D>;

export function oneOf<A, B, C, D, E>(
  one: Parser<A>,
  two: Parser<B>,
  three: Parser<C>,
  four: Parser<D>,
  five: Parser<E>
): Parser<A | B | C | D | E>;

export function oneOf<A>(...parsers: Parser<A>[]): Parser<A> {
  return oneOfMany(...parsers);
}

/**
 * Just like {@link oneOf} but you have to specify the type parameter. Example:
 * `oneOfMany<TYPEPARAM>`.
 *
 * @example
 * The type inference is a bit worse on this function. In most cases you
 * will have to specify the type parameter yourself.
 *
 * ```ts
 * const json: Parser<Json> = P.oneOfMany<Json>(
 *   P.float.map(JNumber),
 *   P.keyword("true").map(() => JBoolean(true)),
 *   P.keyword("false").map(() => JBoolean(false)),
 *   P.keyword("null").map(() => JNull)
 * ```
 *
 * @see
 * - {@link oneOf} like `oneOfMany` but with different type inference.
 *
 * @category Branches
 */
export const oneOfMany = <A>(...parsers: Parser<A>[]): Parser<A> => {
  return A.oneOfMany(...parsers);
};

// LOOP

/**
 * @category Loop (All)
 */
export type Step<STATE, A> = A.Step<STATE, A>;

/**
 * A parser that can loop indefinitely. This can be helpful when parsing
 * repeated structures, like a bunch of statements:
 *
 * ```ts
 *     // Note that we are useing a mutable list here. Dangerous but OK in this scenario.
 *     const statementsHelp = (stmts: Stmt[]): P.Parser<P.Step<Stmt[], Stmt[]>> => {
 *       return P.oneOf(
 *         P.succeed((stmt) => {
 *           stmts.push(stmt);
 *           return new P.Loop(stmts);
 *         })
 *           .apply(statement)
 *           .skip(P.spaces)
 *           .skip(P.symbol(";"))
 *           .skip(P.spaces),
 *         P.succeed(P.Unit).map(() => new P.Done(stmts))
 *       );
 *     };
 *
 *     const statements: P.Parser<Stmt[]> = P.loop([])(statementsHelp);
 * ```
 *
 * **IMPORTANT NOTE:** Parsers like `succeed(Unit)` and `chompWhile(isAlpha)` can
 * succeed without consuming any characters. So in some cases you may want to use
 * {@link getOffset} to ensure that each step actually consumed characters.
 * Otherwise you could end up in an infinite loop!
 *
 * **Note:** Anything you can write with `loop`, you can also write as a parser
 * that chomps some characters `andThen` calls itself with new arguments. The
 * problem with calling `andThen` recursively is that it grows the stack, so you
 * cannot do it indefinitely. So `loop` allow us to write more efficient parsers.
 * Of course you could also use the looping constructs built into javascript/typescript itself.
 *
 * @see
 * - {@link https://en.wikipedia.org/wiki/Finite-state_machine Finite State Machine }
 *
 * @category Loops
 * @category Loop (All)
 */
export const loop =
  <STATE>(state: STATE) =>
  <A>(fn: (s: STATE) => Parser<Step<STATE, A>>): Parser<A> => {
    return A.loop(state)(fn);
  };

// BACKTRACKABLE

/**
 * It is quite tricky to use `backtrackable` well! It can be very useful, but
 * also can degrade performance and error message quality.
 *
 * Read {@link https://github.com/honungsburk/kombo/blob/master/semantics.md this document }
 * to learn how `oneOf`, `backtrackable`, and `commit` work and interact with
 * each other. It is subtle and important!
 *
 * @category Branches
 */
export const backtrackable = <A>(parser: Parser<A>): Parser<A> => {
  return A.backtrackable(parser);
};
/**
 * `commit` is almost always paired with `backtrackable` in some way, and it
 * is tricky to use well.
 *
 * Read {@link https://github.com/honungsburk/kombo/blob/master/semantics.md this document}
 * to learn how `oneOf`, `backtrackable`, and `commit` work and interact with
 * each other. It is subtle and important!
 *
 *
 * @category Branches
 */
export const commit = <A>(value: A): Parser<A> => {
  return A.commit(value);
};

// SYMBOL

/**
 * Parse symbols like `(` and `,`.
 *
 * ```ts
 *   run(symbol("["))("[") // => Ok ()
 *   run(symbol("["))("4") // => Err ... (ExpectingSymbol "[") ...
 * ```
 *
 * **Note:** This is good for stuff like brackets and semicolons, but it probably
 * should not be used for binary operators like `+` and `-` because you can find
 * yourself in weird situations. For example, is `"3--4"` a typo? Or is it `"3 - -4"`?
 * I have had better luck with `chompWhile(isSymbol)` and sorting out which
 * operator it is afterwards.
 *
 * @category Building Blocks
 */
export const symbol = (str: string): Parser<A.Unit> => {
  return A.symbol(A.Token(str, ExpectingSymbol(str)));
};

// TOKEN

/**
 * Parse exactly the given string, without any regard to what comes next.
 *
 * A potential pitfall when parsing keywords is getting tricked by variables that
 * start with a keyword, like `let` in `letters` or `import` in `important`. This
 * is especially likely if you have a whitespace parser that can consume zero
 * charcters. So the {@link keyword} parser is defined with `token` and a
 * trick to peek ahead a bit:
 *
 * ```ts
 * const isVarChar = (char: string) => {
 *   return Helpers.isAlphaNum(char) || char === "_";
 * };
 *
 * const checkEnding =
 *   (kwd: string) =>
 *   (isBadEnding: boolean): P.Parser<P.Unit> => {
 *     if (isBadEnding) {
 *       return P.problem("expecting the `" + kwd + "` keyword");
 *     } else {
 *       return P.commit(P.Unit);
 *     }
 *   };
 *
 * const keyword = (kwd: string): P.Parser<P.Unit> => {
 *   return P.succeed((v: P.Unit) => v)
 *     .skip(P.backtrackable(P.token(kwd)))
 *     .keep(P.oneOf(P.backtrackable(P.chompIf(isVarChar)), P.succeed(false)))
 *     .andThen(checkEnding(kwd));
 * };
 * ```
 *
 * This definition is specially designed so that (1) if you really see `let` you
 * commit to that path and (2) if you see `letters` instead you can backtrack and
 * try other options. If I had just put a `backtrackable` around the whole thing
 * you would not get (1) anymore.
 *
 * @category Building Blocks
 */
export const token = (token: string): Parser<A.Unit> => {
  return A.token(toToken(token));
};

// HELPER
function toToken(str: string): A.Token<Problem> {
  return { value: str, problem: Expecting(str) };
}

// KEYWORD

/**
 * Parse keywords like `let`, `case`, and `type`.
 *
 * ```ts
 *   run(keyword("let"))("let")     => Ok()
 *   run(keyword("let"))("var")     => Err ... (ExpectingKeyword("let")) ...
 *   run(keyword("let"))("letters") => Err ... (ExpectingKeyword("let")) ...
 * ```
 *
 * **Note:** Notice the third case there! `keyword` actually looks ahead one
 * character to make sure it is not a letter, number, or underscore. The goal is
 * to help with parsers like this:
 *
 * ```ts
 *  succeed(x => x)
 *    .skip(keyword("let"))
 *    .skip(spaces)
 *    .apply(elmVar)
 *    .skip(spaces)
 *    .skip(symbol("="))
 * ```
 *
 * The trouble is that `spaces` may chomp zero characters (to handle expressions
 * like `[1,2]` and `[ 1 , 2 ]`) and in this case, it would mean `letters` could
 * be parsed as `let ters` and then wonder where the equals sign is! Check out the
 * {@link token} docs if you need to customize this!
 *
 * @category Building Blocks
 */
export const keyword = (kwd: string): Parser<A.Unit> => {
  return A.keyword(A.Token(kwd, ExpectingKeyword(kwd)));
};

// NUMBERS

/**
 * Parse integers.
 *
 * @remarks
 *
 * @example Behavior
 *
 * By default it only parsers non-negative integers
 *
 * ```ts
 *     run(int("1"))    // => Ok(1)
 *     run(int("1234")) // => Ok(1234)
 *     run(int("-789")) // => Err(...)
 *     run(int("0123")) // => Err(...)
 *     run(int("1.34")) // => Err(...)
 *     run(int("1e31")) // => Err(...)
 *     run(int("123a")) // => Err(...)
 *     run(int("0x1A")) // => Err(...)
 * ```
 *
 * If you want to handle a leading `+` or `-` you should do it with a custom
 * parser like this:
 *
 * ```ts
 *     const myInt: Parser<number> = oneOf(
 *       succeed((n: number) => n * -1)
 *         .skip(symbol("-"))
 *         .apply(int),
 *       int
 *     );
 * ```
 *
 * **Note:** If you want a parser for both `Int` and `Float` literals, check out
 * {@link number} below. It will be faster than using `oneOf` to combining
 * `int` and `float` yourself.
 *
 * @category Building Blocks
 */
export const int: Parser<number> = A.int(ExpectingInt)(ExpectingInt);

/**
 * Parse floats.
 *
 * @remarks
 *
 * @example
 * ```ts
 *   run(float("123"))       => Ok(123)
 *   run(float("3.1415"))    => Ok(3.1415)
 *   run(float("0.1234"))    => Ok(0.1234)
 *   run(float(".1234"))     => Ok(0.1234)
 *   run(float("1e-42"))     => Ok(1e-42)
 *   run(float("6.022e23"))  => Ok(6.022e23)
 *   run(float("6.022E23"))  => Ok(6.022e23)
 *   run(float("6.022e+23")) => Ok(6.022e23)
 * ```
 *
 * If you want to disable literals like `.123` (like in Elm) you could write
 * something like this:
 * ```ts
 *   elmFloat : Parser Float
 *   elmFloat =
 *     oneOf
 *       [ symbol "."
 *           |. problem "floating point numbers must start with a digit, like 0.25"
 *       , float
 *       ]
 * ```
 *
 * **Note:** If you want a parser for both `Int` and `Float` literals, check out
 * {@link number} below. It will be faster than using `oneOf` to combining
 * `int` and `float` yourself.
 *
 * @category Building Blocks
 */
export const float: Parser<number> = A.float(ExpectingFloat)(ExpectingFloat);

// Helper
function toResult<V, W>(value: V | undefined, def: W): Results.Result<V, W> {
  return value !== undefined ? Results.Ok(value) : Results.Err(def);
}

/**
 * Parse a bunch of different kinds of numbers without backtracking.
 *
 * @remarks
 *
 * @example
 * A parser for Elm would need to handle integers, floats, and hexadecimal like this:
 *
 * ```ts
 *     type Number = IntE | FloatE;
 *
 *     class IntE {
 *       constructor(public readonly value: number) {}
 *     }
 *
 *     class FloatE {
 *       constructor(public readonly value: number) {}
 *     }
 *     const elmNumber: P.Parser<Number> = P.number({
 *       int: (n) => new IntE(n),
 *       hex: (n) => new IntE(n), // 0x001A is allowed
 *       float: (n) => new FloatE(n),
 *     });
 * ```
 *
 * @example Float
 *
 * If you wanted to implement the [`float`](#float) parser, it would be like this:
 * ```ts
 *     const float: Parser<number> =
 *         number({
 *           int: (n) => n,
 *           float: (n) => n
 *         });
 * ```
 *
 * Notice that it actually is processing `int` results! This is because `123`
 * looks like an integer to me, but maybe it looks like a float to you. If you had
 * `int : undefiend`, floats would need a decimal like `1.0` in every case. If you
 * like explicitness, that may actually be preferable!
 *
 * **Note:** This function does not check for weird trailing characters in the
 * current implementation, so parsing `123abc` can succeed up to `123` and then
 * move on. This is helpful for people who want to parse things like `40px` or
 * `3m`, but it requires a bit of extra code to rule out trailing characters in
 * other cases.
 *
 *
 * @category Building Blocks
 */
export const number = <A>(args: {
  int?: (n: number) => A;
  hex?: (n: number) => A;
  binary?: (n: number) => A;
  octal?: (n: number) => A;
  float?: (n: number) => A;
}): Parser<A> => {
  return A.number<A, Problem>({
    int: toResult(args.int, ExpectingInt),
    hex: toResult(args.int, ExpectingHex),
    octal: toResult(args.int, ExpectingOctal),
    binary: toResult(args.int, ExpectingBinary),
    float: toResult(args.int, ExpectingFloat),
    invalid: ExpectingNumber,
    expecting: ExpectingNumber,
  });
};

// END

/**
 * Check if you have reached the end of the string you are parsing.
 *
 * @remarks
 *
 * @example Just An Int
 *
 * ```ts
 *     const justAnInt: Parser<number> =
 *       succeed((n: number) => n)
 *         .apply(int)
 *         .skip(end)
 *
 *     // run(justAnInt("90210")) => Ok(90210)
 *     // run(justAnInt("1 + 2")) => Err(...)
 *     // run(int("1 + 2")) .     => Ok(1)
 * ```
 *
 * Parsers can succeed without parsing the whole string. Ending your parser
 * with `end` guarantees that you have successfully parsed the whole string.
 *
 * @category Building Blocks
 */
export const end: Parser<A.Unit> = A.end(ExpectingEnd);

// CHOMPED STRINGS

/**
 * Sometimes parsers like `int` or `variable` cannot do exactly what you
 * need. The "chomping" family of functions is meant for that case!
 *
 * @remarks
 * Maybe you need to parse {@link https://www.w3schools.com/php/php_variables.asp valid PHP variables}
 * like `$x` and `$txt`:
 *
 * ```ts
 *     const php: P.Parser<string> = P.getChompedString(
 *       P.succeed(P.Unit)
 *         .skip(P.chompIf((c: string) => c === "$"))
 *         .skip(P.chompIf((c: string) => Helpers.isAlphaNum(c) || c === "_"))
 *         .skip(P.chompWhile((c: string) => Helpers.isAlphaNum(c) || c === "_"))
 *     );
 * ```
 * The idea is that you create a bunch of chompers that validate the underlying
 * characters. Then `getChompedString` extracts the underlying `String` efficiently.
 *
 * **Note:** Maybe it is helpful to see how you can use {@link getOffset}
 * and {@link getSource} to implement this function:
 *
 * ```ts
 *     const getChompedString = (parser: P.Parser<any>) => {
 *       return P.succeed(
 *         (from: number) => (to: number) => (str: string) => str.slice(from, to)
 *       )
 *         .apply(P.getOffset())
 *         .skip(parser)
 *         .apply(P.getOffset())
 *         .apply(P.getSource());
 *     };
 * ```
 *
 *
 * @category Chompers
 */
export const getChompedString = (parser: Parser<unknown>): Parser<string> => {
  return A.getChompedString(parser);
};

/**
 * This works just like {@link Simple!getChompedString} but gives
 * a bit more flexibility. For example, maybe you want to parse Elm doc comments
 * and get (1) the full comment and (2) all of the names listed in the docs.
 *
 * @example Example Implementation
 *
 * You could implement `mapChompedString` like this:
 *
 * ```ts
 *     const mapChompedString =
 *       <A, B>(fn: (s: string, v: A) => B) =>
 *       (parser: P.Parser<A>): P.Parser<B> => {
 *         return P.succeed(
 *           (start: number) => (value: A) => (end: number) => (src: string) =>
 *             fn(src.slice(start, end), value)
 *         )
 *           .apply(P.getOffset)
 *           .apply(parser)
 *           .apply(P.getOffset)
 *           .apply(P.getSource);
 *   };
 * ```
 *
 *
 * @category Chompers
 */
export const mapChompedString =
  <A, B>(fn: (s: string, v: A) => B) =>
  (parser: Parser<A>): Parser<B> => {
    return A.mapChompedString(fn)(parser);
  };
// CHOMP IF

/**
 * Chomp one character if it passes the test.
 * @remarks
 *
 * @example
 * ```ts
 *    const chompUpper: P.Parser<P.Unit> =
 *      P.chompIf(Helpers.isUpper)
 * ```
 *
 * So this can chomp a character like `T` and produces a `()` value.
 *
 *
 * @category Chompers
 */
export const chompIf = (isGood: (char: string) => boolean): Parser<A.Unit> => {
  return A.chompIf(isGood)(UnexpectedChar);
};

// CHOMP WHILE

/**
 * Chomp zero or more characters if they pass the test.
 *
 * @remarks
 *
 * @example
 * This is commonly useful for chomping whitespace or variable names:
 *
 * ```ts
 *     const whitespace: P.Parser<P.Unit> = P.chompWhile(
 *       (c: string) => c == " " || c == "\t" || c == "\n" || c == "\r"
 *     );
 *
 *     const elmVar: P.Parser<string> = P.getChompedString(
 *       P.succeed(P.Unit).skip(
 *         P.chompIf(Helpers.isLower).skip(
 *           P.chompWhile((c: string) => Helpers.isAlphaNum(c) || c == "_")
 *         )
 *       )
 *     );
 * ```
 *
 * **Note:** a `chompWhile` parser always succeeds! This can lead to tricky
 * situations, especially if you define your whitespace with it. In that case,
 * you could accidentally interpret `letx` as the keyword `let` followed by
 * "spaces" followed by the variable `x`. This is why the `keyword` and `number`
 * parsers peek ahead, making sure they are not followed by anything unexpected.
 *
 * @category Chompers
 */
export const chompWhile = (
  isGood: (char: string) => boolean
): Parser<A.Unit> => {
  return A.chompWhile(isGood);
};

// CHOMP UNTIL

/**
 * Chomp until you see a certain string.
 *
 * @remarks
 *
 * @example Multi-line comments
 * You could define haskell-style multi-line comments like this:
 *
 * ```ts
 *   const comment: P.Parser<P.Unit> =
 *     P.symbol("{-")
 *       .skip(P.chompUntil("-}"))
 * ```
 *
 * I recommend using {@link multiComment} for this particular scenario
 * though. It can be trickier than it looks!
 *
 * @category Chompers
 */
export const chompUntil = (str: string): Parser<A.Unit> => {
  return A.chompUntil(toToken(str));
};

//CHOMP UNTIL END OR

/**
 * Chomp until you see a certain string or until you run out of characters to
 * chomp!
 *
 * @remarks
 *
 * @example Single-line Comment
 * You could define single-line comments like this:
 *
 * ```ts
 *     const singleLineComment: P.Parser<P.Unit> =
 *       P.symbol("--")
 *         .skip(P.chompUntilEndOr("\n"));
 * ```
 *
 * A file may end with a single-line comment, so the file can end before you see
 * a newline. Tricky!
 *
 * I recommend just using {@link lineComment} for this particular
 * scenario.
 *
 * @category Chompers
 */
export const chompUntilEndOr = (str: string): Parser<A.Unit> => {
  return A.chompUntilEndOr(str);
};

// INDENTATION

/**
 * Some languages are indentation sensitive. Python cares about tabs. Elm
 * cares about spaces sometimes. {@link withIndent} and {@link getIndent} allow you to manage
 * "indentation state" yourself, however is necessary in your scenario.
 *
 * @see
 * - {@link Advanced!Parser.withIndent | Parser.withIndent}
 * - {@link getIndent}
 *
 * @category Indentation
 */
export const withIndent =
  (n: number) =>
  <A>(parser: Parser<A>): Parser<A> => {
    return A.withIndent(n)(parser);
  };

/**
 * When someone said {@link withIndent} earlier, what number did they put in there?
 *
 * - `getIndent()` results in `0`, the default value
 * - `withInden(4)(getIndent())` results in `4`
 *
 * So you are just asking about things you said earlier. These numbers do not leak
 * out of {@link withIndent}, so say we have:
 *
 * ```ts
 *     succeed((a: number) => (b: number) => [a, b])
 *       .apply(withIndent(4)(getIndent))
 *       .apply(getIndent);
 * ```
 *
 * @see
 * - {@link Advanced!Parser.getIndent | Parser.getIndent}
 * - {@link withIndent}
 *
 * @category Indentation
 */
export const getIndent: Parser<number> = A.getIndent;

// POSITION

/**
 * Code editors treat code like a grid, with rows and columns. The start is
 * `row=1` and `col=1`. As you chomp characters, the col increments. When you
 * run into a `\n` character, the `row` increments and `col` goes back to `1`.
 *
 * @example
 * In the Elm compiler, they track the start and end position of every
 * expression like this:
 *
 * ```ts
 * type Located<A> = {
 *  start: [number, number],
 *  value: A,
 *  end: [number, number]
 * }
 *
 * const Located = <A>(start: [number, number]) => value: A) => (end: [number, number]): Located<A> => ({
 *  start: start,
 *  value: value,
 *  end: end
 * })
 *
 * const located = <A>(parser: Parser<A>): Parser<Located<A>> => {
 *  return succeed(Located<A>)
 *          .apply(getPosition)
 *          .apply(parser)
 *          .apply(getPosition)
 * }
 *
 * ```
 *
 * So if there is a problem during type inference, they use this saved position
 * information to underline the exact problem!
 *
 * **Note:** Tabs count as one character, so if you are parsing something
 * like Python, I recommend sorting that out *after* parsing. So if I wanted
 * the `^^^^` underline like in Elm, I would find the *row* in the source code
 * and do something like this:
 *
 * ```ts
 * function toUnderlineChar(
 *   minCol: number,
 *   maxCol: number,
 *   col: number,
 *   char: string
 * ): string {
 *   if (minCol <= col && col <= maxCol) {
 *     return "^";
 *   } else if (char === "\t") {
 *     return "\t";
 *   } else {
 *     return " ";
 *   }
 * }
 *
 * function makeUnderline(row: string, minCol: number, maxCol: number): string {
 *   const listOfChars: string[] = [...row];
 *   const underline: string[] = listOfChars.map((char, index) =>
 *     toUnderlineChar(minCol, maxCol, index, char)
 *   );
 *   return underline.join("");
 * }
 * ```
 *
 * So it would preserve any tabs from the source line. There are tons of other
 * ways to do this though. The point is just that you handle the tabs after
 * parsing but before anyone looks at the numbers in a context where tabs may
 * equal 2, 4, or 8.
 *
 * @category Positions
 */
export const getPosition: Parser<[number, number]> = A.getPosition;

/**
 * This is a more efficient version of `getPosition.map(t => t[0])`. Maybe
 * you just want to track the line number for some reason? This lets you do that.
 *
 * See {@link getPosition} for an explanation of rows and columns.
 *
 * @category Positions
 */
export const getRow: Parser<number> = A.getRow;

/**
 * This is a more efficient version of `getPosition.map(t => t[1])`. This can
 * be useful in combination with {@link withIndent} and {@link getIndent}, like this:
 *
 * ```ts
 * const checkIndent: P.Parser<P.Unit> = P.succeed(
 *   (indent: number) => (column: number) => indent <= column
 *  )
 *   .apply(P.getIndent)
 *   .apply(P.getCol)
 *   .andThen((isIdented) => {
 *     if (isIdented) {
 *       return P.succeed(P.Unit);
 *     } else {
 *       return P.problem("expecting more spaces");
 *     }
 *   });
 * ```
 *
 * So the `checkIndent` parser only succeeds when you are "deeper" than the
 * current indent level.
 *
 * @category Positions
 */
export const getCol: Parser<number> = A.getCol;

/**
 * Editors think of code as a grid, but behind the scenes it is just a flat
 * array of UTF-16 characters. `getOffset` tells you your index in that
 * flat array. So if you chomp `"\n\n\n\n"` you are on row 5, column 1,
 * and offset 4.
 *
 * **Note:** JavaScript uses a somewhat odd version of UTF-16 strings,
 * so a single character may take two slots. So in JavaScript, `'abc'.length === 3``
 * but `'🙈🙉🙊'.length === 6`. Try it out!
 *
 * @category Positions
 */
export const getOffset: Parser<number> = A.getOffset;

/**
 * Get the full string that is being parsed. You could use this to define
 * `getChompedString` or `mapChompedString` if you wanted:
 *
 * ```ts
 * const getChompedString = (parser: P.Parser<any>) => {
 *   return P.succeed(
 *     (from: number) => (to: number) => (str: string) => str.slice(from, to)
 *   )
 *     .apply(P.getOffset)
 *     .skip(parser)
 *     .apply(P.getOffset)
 *     .apply(P.getSource);
 * };
 * ```
 *
 * @category Positions
 */
export const getSource: Parser<string> = A.getSource;

// VARIABLES

/**
 * Create a parser for variables. If we wanted to parse type variables in
 * Elm, we could try something like this:
 *
 * ```ts
 * const typeVar: P.Parser<string> = P.variable({
 *   start: Helpers.isLower,
 *   inner: (c: string) => Helpers.isAlphaNum(c) || c === "_",
 *   reserved: new Set(["let", "in", "case", "of"]),
 * });
 * ```
 *
 * This is saying it *must* start with a lower-case character. After that,
 * characters can be letters, numbers, or underscores. It is also saying
 * that if you run into any of these reserved names, it is definitely
 * not a variable.
 *
 * @category Building Blocks
 */
export const variable = (args: {
  start: (char: string) => boolean;
  inner: (char: string) => boolean;
  reserved: Set<string>;
}): Parser<string> => {
  return A.variable({
    expecting: ExpectingVariable,
    ...args,
  });
};

// SEQUENCES

/**
 * Handle things like lists and records, but you can customize the details
 * however you need. Say you want to parse C-style code blocks:
 *
 * ```ts
 * // const statement: Parser<Stmt> =
 *
 * const block: Parser<Stmt[]> =
 *       sequence({
 *         start: "{",
 *         seperator: ";",
 *         end: "}",
 *         spaces: spaces,
 *         item: statement,
 *         trailing: Trailing.Mandatory
 *         }
 *       )
 * ```
 *
 * **Note:** If you need something more custom, do not be afraid to check
 * out the implementation and customize it for your case. It is better to get
 * nice error messages with a lower-level implementation than to try to hack
 * high-level parsers to do things they are not made for.
 *
 * @see
 * - {@link Trailing}
 *
 * @category Loops
 */
export const sequence = <A>(args: {
  start: string;
  seperator: string;
  end: string;
  spaces: Parser<A.Unit>;
  item: Parser<A>;
  trailing: A.Trailing; // TODO: define a new trailing type in this file?
}): Parser<Immutable.List<A>> => {
  return A.sequence({
    start: toToken(args.start),
    separator: toToken(args.seperator),
    end: toToken(args.end),
    spaces: args.spaces,
    item: args.item,
    trailing: args.trailing,
  });
};

// WHITESPACE

/**
 * Parse zero or more `' '`, `'\n'`, and `'\r'` characters.
 * The implementation is pretty simple:
 *
 * ```ts
 *     const spaces = chompWhile(c => c === ' ' || c === '\n' || c === '\r')
 * ```
 *
 * So if you need something different (like tabs) just define an alternative with
 * the necessary tweaks! Check out {@link lineComment} and
 * {@link multiComment} for more complex situations.
 *
 * @category Whitespace
 */
export const spaces: Parser<A.Unit> = A.spaces;

// COMMENTS

/**
 * Parse single-line comments:
 *
 * ```ts
 * const elm = lineComment("--");
 *
 * const js = lineComment("//");
 *
 * const python = lineComment("#");
 * ```
 *
 * This parser is defined like this:
 *
 * ```ts
 * const lineComment = (str: string): Parser<Unit> =>
 *   skip2nd<Unit>(symbol(str))(chompUntilEndOr("\n"));
 * ```
 *
 * So it will consume the remainder of the line. If the file ends before you
 * see a newline, that is fine too.
 *
 * @category Whitespace
 */
export const lineComment = (str: string): Parser<A.Unit> => {
  return A.lineComment(toToken(str));
};

/**
 * Parse multi-line comments. So if you wanted to parse Elm whitespace or JS
 * whitespace, you could say:
 *
 * ```ts
 *
 * const ifProgress =
 *   <A>(parser: P.Parser<A>) =>
 *   (offset: number): P.Parser<P.Step<number, P.Unit>> => {
 *     return P.succeed((x: A) => x)
 *       .skip(parser)
 *       .getOffset()
 *       .map((newOffset) =>
 *         offset === newOffset ? P.Done(P.Unit) : P.Loop(newOffset)
 *       );
 *   };
 *
 * const elm: P.Parser<P.Unit> = P.loop(0)(
 *   ifProgress(
 *     P.oneOf(
 *       P.lineComment("//"),
 *       P.multiComment("/*")("* /")(P.Nestable.Nestable),
 *       P.spaces
 *     )
 *   )
 * );
 *
 * const js: P.Parser<P.Unit> = P.loop(0)(
 *   ifProgress(
 *     P.oneOf(
 *       P.lineComment("//"),
 *       P.multiComment("/*")("* /")(P.Nestable.NotNestable),
 *       P.chompWhile((c) => c == " " || c == "\n" || c == "\r" || c == "\t")
 *     )
 *   )
 * );
 *```
 * `"* /"` is incorrect, it should be `"*​/"` but that requires me to use a
 * {@link https://unicode-explorer.com/c/200B zero with space} character,
 * confusing anyone who copies the code as to why the example doesn't work.
 *
 * **Note:** The fact that `spaces` comes last in the definition of `elm` is very
 * important! It can succeed without consuming any characters, so if it were
 * the first option, it would always succeed and bypass the others! (Same is
 * true of `chompWhile` in `js`.) This possibility of success without consumption
 * is also why wee need the `ifProgress` helper. It detects if there is no
 * more whitespace to consume.
 *
 * @category Whitespace
 */
export const multiComment =
  (open: string) =>
  (close: string) =>
  (nestable: A.Nestable): Parser<A.Unit> => {
    return A.multiComment(toToken(open))(toToken(close))(nestable);
  };
