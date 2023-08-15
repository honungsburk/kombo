import * as Results from "./Result.js";
import * as Helpers from "./Helpers.js";
import * as immutable from "immutable";
import {
  Parser,
  State,
  PStep,
  GetArgumentType,
  GetReturnType,
  DeadEnd,
  isGood,
  isBad,
  bagToList,
  Good,
  Bad,
  fromInfo,
  fromState,
  Unit,
  Empty,
  Bag,
  Append,
  Located,
} from "./Parser.js";
import ISource from "./Source/ISource.js";
import IStringSource from "./Source/IStringSource.js";
import StringSource from "./Source/StringSource.js";

////////////////////////////////////////////////////////////////////////////////
// Internals
////////////////////////////////////////////////////////////////////////////////

/**
 * @hidden
 */
class ParserImpl<SRC extends ISource<any, any>, A, CTX = never, PROBLEM = never>
  implements Parser<SRC, A, CTX, PROBLEM>
{
  constructor(
    public exec: (
      s: State<SRC, unknown>
    ) => Promise<PStep<SRC, A, CTX, PROBLEM>>
  ) {}

  map<B>(fn: (v: A) => B): Parser<SRC, B, CTX, PROBLEM> {
    return map(fn)(this);
  }

  andThen<B, CTX2, PROBLEM2>(
    fn: (v: A) => Parser<SRC, B, CTX2, PROBLEM2>
  ): Parser<SRC, B, CTX | CTX2, PROBLEM | PROBLEM2> {
    return andThen(fn)(this);
  }

  skip<CTX2, PROBLEM2>(
    other: Parser<SRC, unknown, CTX2, PROBLEM2>
  ): Parser<SRC, A, CTX | CTX2, PROBLEM | PROBLEM2> {
    return skip2nd(this)(other);
  }

  keep<B, CTX2, PROBLEM2>(
    other: Parser<SRC, B, CTX2, PROBLEM2>
  ): Parser<SRC, B, CTX | CTX2, PROBLEM | PROBLEM2> {
    return this.andThen(() => other);
  }

  apply<CTX2, PROBLEM2>(
    parser: Parser<SRC, GetArgumentType<A>, CTX2, PROBLEM2>
  ): Parser<SRC, GetReturnType<A>, CTX | CTX2, PROBLEM | PROBLEM2> {
    return apply(
      this as Parser<
        SRC,
        (a: GetArgumentType<A>) => GetReturnType<A>,
        CTX | CTX2,
        PROBLEM
      >
    )(parser);
  }

  run(src: SRC): Promise<Results.Result<A, DeadEnd<CTX, PROBLEM>[]>> {
    return run(this)(src);
  }

  or<B, CTX2, PROBLEM2>(
    other: Parser<SRC, B, CTX2, PROBLEM2>
  ): Parser<SRC, A | B, CTX | CTX2, PROBLEM | PROBLEM2> {
    return oneOf(this, other);
  }

  optional(): Parser<SRC, A | undefined, CTX, PROBLEM> {
    return optional(this);
  }

  backtrackable(): Parser<SRC, A, CTX, PROBLEM> {
    return backtrackable(this);
  }

  getChompedString(): Parser<SRC, string, CTX, PROBLEM> {
    return getChompedString(this);
  }

  mapChompedString<B>(
    fn: (s: string, v: A) => B
  ): Parser<SRC, B, CTX, PROBLEM> {
    return mapChompedString(fn)(this);
  }

  getIndent(): Parser<SRC, number, CTX, PROBLEM> {
    return this.keep(getIndent);
  }

  withIndent(newIndent: number): Parser<SRC, A, CTX, PROBLEM> {
    return withIndent(newIndent)(this);
  }

  getPosition(): Parser<SRC, [number, number], CTX, PROBLEM> {
    return this.keep(getPosition);
  }
  getRow(): Parser<SRC, number, CTX, PROBLEM> {
    return this.keep(getRow);
  }
  getCol(): Parser<SRC, number, CTX, PROBLEM> {
    return this.keep(getCol);
  }
  getOffset(): Parser<SRC, number, CTX, PROBLEM> {
    return this.keep(getOffset);
  }
  getSource(): Parser<SRC, string, CTX, PROBLEM> {
    return this.keep(getSource);
  }
}

// Run

/**
 * This works just like {@link Simple!run | Simple.run}.
 * The only difference is that when it fails, it has much more precise information
 * for each dead end.
 *
 * @see
 * - {@link Parser!Parser.run} is the infix version of `run`
 *
 * @category Parsers
 */
export const run =
  <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
    parser: Parser<SRC, A, CTX, PROBLEM>
  ) =>
  async (src: SRC): Promise<Results.Result<A, DeadEnd<CTX, PROBLEM>[]>> => {
    const res = await parser.exec({
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
 * Just like {@link Simple!succeed | Simple.succeed}
 *
 * @category Primitives
 */
export function succeed<A>(a: A): Parser<any, A, never, never> {
  return new ParserImpl(async (s) => Good(false, a, s));
}

/**
 *
 * Just like {@link Simple!problem | Simple.problem} except you provide a custom
 * type for your problem.
 *
 * @category Primitives
 */
export function problem<PROBLEM>(
  p: PROBLEM
): Parser<any, never, never, PROBLEM> {
  return new ParserImpl(async (s) => Bad(false, fromState(s, p)));
}

// MAPPING

/**
 * Just like {@link Simple!map | Simple.map}.
 *
 * @see
 * - {@link Parser!Parser.map} is the infix version of `map`
 *
 * @category Mapping
 */
export const map =
  <A, B>(fn: (a: A) => B) =>
  <SRC extends ISource<any, any>, CTX, PROBLEM>(
    parser: Parser<SRC, A, CTX, PROBLEM>
  ): Parser<SRC, B, CTX, PROBLEM> => {
    return new ParserImpl(async (s) => {
      const res = await parser.exec(s);
      if (isGood(res)) {
        return Good(res.haveConsumed, fn(res.value), res.state);
      } else {
        return res;
      }
    });
  };

/**
 * Just like {@link Simple!map2 | Simple.map2}
 *
 * @category Mapping
 */
export const map2 =
  <A, B, C>(fn: (a: A, b: B) => C) =>
  <SRC extends ISource<any, any>, CTX, PROBLEM>(
    parserA: Parser<SRC, A, CTX, PROBLEM>
  ) =>
  <CTX2, PROBLEM2>(
    parserB: Parser<SRC, B, CTX2, PROBLEM2>
  ): Parser<SRC, C, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return new ParserImpl(
      async (s0): Promise<PStep<SRC, C, CTX | CTX2, PROBLEM | PROBLEM2>> => {
        const res0 = await parserA.exec(s0);
        if (isBad(res0)) {
          return res0;
        } else {
          const res1 = await parserB.exec(res0.state);
          if (isBad(res1)) {
            return Bad(res0.haveConsumed || res1.haveConsumed, res1.bag);
          } else {
            return Good(
              res0.haveConsumed || res1.haveConsumed,
              fn(res0.value, res1.value),
              res1.state
            );
          }
        }
      }
    );
  };

/**
 * Just like {@link Simple!apply | Simple.apply}.
 *
 * @see
 * - {@link Parser!Parser.apply} is the infix version of `apply`
 *
 * @category Mapping
 */
export const apply =
  <SRC extends ISource<any, any>, A, B, CTX, PROBLEM>(
    parseFunc: Parser<SRC, (a: A) => B, CTX, PROBLEM>
  ) =>
  <CTX2, PROBLEM2>(
    parseArg: Parser<SRC, A, CTX2, PROBLEM2>
  ): Parser<SRC, B, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return map2((fn: (a: A) => B, arg: A) => fn(arg))(parseFunc)(parseArg);
  };

/**
 * Just like {@link Simple!skip1st}.
 *
 * @see
 * - {@link Parser!Parser.keep } is the infix version of `skip1st`.
 * - {@link skip2nd } is similar but skips the second argument instead of the first.
 *
 * @category Mapping
 */
export const skip1st =
  <SRC extends ISource<any, any>, CTX, PROBLEM>(
    first: Parser<SRC, unknown, CTX, PROBLEM>
  ) =>
  <A, CTX2, PROBLEM2>(
    second: Parser<SRC, A, CTX2, PROBLEM2>
  ): Parser<SRC, A, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return map2((a, b: A) => b)(first)(second);
  };

/**
 * Just like {@link Simple!skip2nd}.
 *
 * @see
 * - {@link Parser!Parser.skip } is the infix version of `skip2nd`.
 * - {@link skip1st } is similar but skips the first argument instead of the second.
 *
 * @category Mapping
 */
export const skip2nd =
  <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
    keepParser: Parser<SRC, A, CTX, PROBLEM>
  ) =>
  <CTX2, PROBLEM2>(
    ignoreParser: Parser<SRC, unknown, CTX2, PROBLEM2>
  ): Parser<SRC, A, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return map2((a: A, b) => a)(keepParser)(ignoreParser);
  };

// AND THEN

/**
 * Just like {@link Simple!andThen | Simple.andThen}.
 *
 * @see
 * - {@link Parser!Parser.andThen } is the infix version of `andThen`.
 *
 * @category Mapping
 */
export const andThen =
  <SRC extends ISource<any, any>, A, B, CTX, PROBLEM>(
    fn: (a: A) => Parser<SRC, B, CTX, PROBLEM>
  ) =>
  <CTX2, PROBLEM2>(
    p: Parser<SRC, A, CTX2, PROBLEM2>
  ): Parser<SRC, B, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return new ParserImpl(
      async (ctx0): Promise<PStep<SRC, B, CTX | CTX2, PROBLEM | PROBLEM2>> => {
        const res1 = await p.exec(ctx0);

        if (isBad(res1)) {
          return res1;
        } else {
          const res2 = await fn(res1.value).exec(res1.state);
          if (isBad(res2)) {
            return Bad(res1.haveConsumed || res2.haveConsumed, res2.bag);
          } else {
            return Good(
              res1.haveConsumed || res2.haveConsumed,
              res2.value,
              res2.state
            );
          }
        }
      }
    );
  };

// LAZY

/**
 * Just like {@link Simple!lazy | Simple.lazy}.
 *
 * @category Helpers
 */
export const lazy = <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  thunk: () => Parser<SRC, A, CTX, PROBLEM>
): Parser<SRC, A, CTX, PROBLEM> => {
  return new ParserImpl((ctx) => {
    return thunk().exec(ctx);
  });
};

// ONE OF

/**
 * Just like {@link Simple!oneOf | Simple.oneOf}
 *
 * @see
 * - {@link Parser!Parser.or | Parser.or} is the infix version of `oneOf`
 * - {@link oneOfMany | Advanced.oneOfMany} for when you need to choose between more than 5 parsers.
 *
 * @category Branches
 */
export function oneOf<SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  one: Parser<SRC, A, CTX, PROBLEM>
): Parser<SRC, A, CTX, PROBLEM>;

export function oneOf<
  SRC extends ISource<any, any>,
  A,
  B,
  CTX1,
  CTX2,
  PROBLEM1,
  PROBLEM2
>(
  one: Parser<SRC, A, CTX1, PROBLEM1>,
  two: Parser<SRC, B, CTX2, PROBLEM2>
): Parser<SRC, A | B, CTX1 | CTX2, PROBLEM1 | PROBLEM2>;

export function oneOf<
  SRC extends ISource<any, any>,
  A,
  B,
  C,
  CTX1,
  CTX2,
  CTX3,
  PROBLEM1,
  PROBLEM2,
  PROBLEM3
>(
  one: Parser<SRC, A, CTX1, PROBLEM1>,
  two: Parser<SRC, B, CTX2, PROBLEM2>,
  three: Parser<SRC, C, CTX3, PROBLEM3>
): Parser<SRC, A | B | C, CTX1 | CTX2 | CTX3, PROBLEM1 | PROBLEM2 | PROBLEM3>;

export function oneOf<
  SRC extends ISource<any, any>,
  A,
  B,
  C,
  D,
  CTX1,
  CTX2,
  CTX3,
  CTX4,
  PROBLEM1,
  PROBLEM2,
  PROBLEM3,
  PROBLEM4
>(
  one: Parser<SRC, A, CTX1, PROBLEM1>,
  two: Parser<SRC, B, CTX2, PROBLEM2>,
  three: Parser<SRC, C, CTX3, PROBLEM3>,
  four: Parser<SRC, D, CTX4, PROBLEM4>
): Parser<
  SRC,
  A | B | C | D,
  CTX1 | CTX2 | CTX3 | CTX4,
  PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4
>;

export function oneOf<
  SRC extends ISource<any, any>,
  A,
  B,
  C,
  D,
  E,
  CTX1,
  CTX2,
  CTX3,
  CTX4,
  CTX5,
  PROBLEM1,
  PROBLEM2,
  PROBLEM3,
  PROBLEM4,
  PROBLEM5
>(
  one: Parser<SRC, A, CTX1, PROBLEM1>,
  two: Parser<SRC, B, CTX2, PROBLEM2>,
  three: Parser<SRC, C, CTX3, PROBLEM3>,
  four: Parser<SRC, D, CTX4, PROBLEM4>,
  five: Parser<SRC, E, CTX5, PROBLEM5>
): Parser<
  SRC,
  A | B | C | D | E,
  CTX1 | CTX2 | CTX3 | CTX4 | CTX5,
  PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4 | PROBLEM5
>;

export function oneOf<SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  ...parsers: Parser<SRC, A, CTX, PROBLEM>[]
): Parser<SRC, A, CTX, PROBLEM> {
  return oneOfMany(...parsers);
}

/**
 * Just like {@link Simple!oneOfMany | Simple.oneOfMany}
 *
 * @see
 * - For better type inference checkout {@link oneOf | Advanced.oneOf}
 *
 * @category Branches
 */
export function oneOfMany<SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  ...parsers: Parser<SRC, A, CTX, PROBLEM>[]
): Parser<SRC, A, CTX, PROBLEM> {
  return new ParserImpl((ctx) => oneOfHelp(ctx, Empty, parsers));
}

async function oneOfHelp<SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  ctx0: State<SRC, unknown>,
  bag: Bag<CTX, PROBLEM>,
  parsers: Parser<SRC, A, CTX, PROBLEM>[]
): Promise<PStep<SRC, A, CTX, PROBLEM>> {
  let localBag = bag;

  for (const parser of parsers) {
    const res = await parser.exec(ctx0);
    if (isGood(res) || res.haveConsumed) {
      return res;
    }
    localBag = Append(localBag, res.bag);
  }

  return Bad(false, localBag);
}

// LOOP

/**
 * Just like {@link Simple!Step | Simple.Step}
 *
 * @see
 * - {@link Loop}
 * - {@link Done}
 *
 * @category Loop (All)
 */
export type Step<STATE, A> = Loop<STATE> | Done<A>;

/**
 * Just like {@link Simple!Loop | Simple.Loop}
 *
 * @see
 * - {@link Step}
 * - {@link Done}
 * - {@link isLoop}
 *
 * @category Loop (All)
 */
export type Loop<STATE> = {
  readonly kind: "LOOP";
  readonly value: STATE;
};

/**
 * When you want to continue your {@link Simple!loop}.
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
 * Just like {@link Simple!Done | Simple.Done}
 *
 * @see
 * - {@link Step}
 * - {@link Loop}
 * - {@link isDone}
 *
 * @category Loop (All)
 */
export type Done<A> = {
  readonly kind: "DONE";
  readonly value: A;
};

/**
 * When you want to complete your {@link Simple!loop}.
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
 * Check that a step is a {@link Loop}
 *
 * @see
 * - {@link Loop}
 *
 * @category Loop (All)
 */
export function isLoop<STATE>(x: Step<STATE, unknown>): x is Loop<STATE> {
  return x.kind === "LOOP";
}

/**
 * Check that a step is a {@link Done}
 *
 * @see
 * - {@link Done}
 *
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
  <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
    fn: (state: STATE) => Parser<SRC, Step<STATE, A>, CTX, PROBLEM>
  ): Parser<SRC, A, CTX, PROBLEM> => {
    return new ParserImpl((s) => loopHelp(state, fn, s));
  };

const loopHelp = async <SRC extends ISource<any, any>, STATE, A, CTX, PROBLEM>(
  state: STATE,
  fn: (state: STATE) => Parser<SRC, Step<STATE, A>, CTX, PROBLEM>,
  s: State<SRC, CTX>
): Promise<PStep<SRC, A, CTX, PROBLEM>> => {
  let tmpState = state;
  let tmpS = s;
  let p = false;

  while (true) {
    let parse = fn(tmpState);
    let res = await parse.exec(tmpS);

    if (isGood(res)) {
      const val = res.value;
      p = p || res.haveConsumed;
      if (isLoop(val)) {
        tmpState = val.value;
        tmpS = res.state;
      } else {
        return Good(p, val.value, res.state);
      }
    } else {
      return Bad(p, res.bag);
    }
  }
};

// BACKTRACKABLE

/**
 * Just like {@link Simple!backtrackable | Simple.backtrackable}
 *
 * @category Branches
 */
export const backtrackable = <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  parser: Parser<SRC, A, CTX, PROBLEM>
): Parser<SRC, A, CTX, PROBLEM> => {
  return new ParserImpl(async (ctx) => {
    const res = await parser.exec(ctx);
    if (isBad(res)) {
      return Bad(false, res.bag);
    } else {
      return Good(false, res.value, res.state);
    }
  });
};

/**
 * Just like {@link Simple!commit | Simple.commit}
 *
 * @category Branches
 */
export const commit = <A>(a: A): Parser<never, A, never, never> => {
  return new ParserImpl((s) => Good(true, a, s));
};

// Token TODO: Rename to CHUNK

/**
 * With the simpler `Parser` module, you could just say `symbol(",")` and
 * parse all the commas you wanted. But now that we have a custom type for our
 * problems, we have to specify that as well. So anywhere you just used
 * a `string` in the simpler module, you now use a `Token<Problem>` in the advanced
 * module:
 *
 * @example
 * ```ts
 *  enum Problem {
 *   ExpectingComma,
 *   ExpectingListEnd
 *  }
 *
 * const comma = Token(",", Problem.ExpectingComma)
 *
 * const listEnd = Token("]", Problem.ExpectingListEnd)
 * ```
 *
 * You can be creative with your custom type. Maybe you want a lot of detail.
 * Maybe you want looser categories. It is a custom type. Do what makes sense for
 * you!
 *
 * @see
 * - {@link Token:function}
 *
 * @category Token (All)
 */
export type Token<CHUNK, PROBLEM> = {
  value: CHUNK;
  problem: PROBLEM;
};

/**
 * Create a token.
 *
 * @see
 * - {@link Token:type}
 *
 * @category Token (All)
 */
export function Token<CHUNK, PROBLEM>(
  value: CHUNK,
  problem: PROBLEM
): Token<CHUNK, PROBLEM> {
  return {
    value: value,
    problem: problem,
  };
}

/**
 *
 * Just like {@link Simple!token | Simple.token} except you provide a {@link Token:type}
 * specifying your custom type of problems.
 *
 * @see
 * - {@link Token:type | Token type}
 * - {@link Token:function | Token function}
 *
 * @category Branches
 * @category Token (All)
 */
export function token<SRC extends ISource<any, CHUNK>, CHUNK, PROBLEM>(
  token: Token<CHUNK, PROBLEM>
): Parser<SRC, Unit, never, PROBLEM> {
  const progress = token.value.length !== 0;
  return new ParserImpl(async (s) => {
    const [newOffset, newRow, newCol] = await s.src.isSubChunk(
      token.value,
      s.offset,
      s.row,
      s.col
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
 * Just like {@link Simple!int | Simple.int} where you have to handle negation
 * yourself. The only difference is that you provide two potential problems:
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
  <SRC extends IStringSource>(
    invalid: PROBLEM
  ): Parser<SRC, number, never, PROBLEM> => {
    return number({
      hex: Results.Err(invalid),
      int: Results.Ok((id: number) => id),
      octal: Results.Err(invalid),
      binary: Results.Err(invalid),
      float: Results.Err(invalid),
      invalid: invalid,
      expecting: expecting,
    });
  };

/**
 * Just like {@link Simple!float | Simple.float} where you have to handle negation
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
  <SRC extends IStringSource>(
    invalid: PROBLEM
  ): Parser<SRC, number, never, PROBLEM> => {
    return number({
      int: Results.Ok((id: number) => id),
      hex: Results.Err(invalid),
      octal: Results.Err(invalid),
      binary: Results.Err(invalid),
      float: Results.Ok((id: number) => id),
      invalid: invalid,
      expecting: expecting,
    });
  };

/**
 * Just like {@link Simple!number | Simple.number} where you have to handle
 * negation yourself. The only difference is that you provide all the potential
 * problems.
 *
 * @See
 * - {@link int}
 * - {@link float}
 *
 * @category Building Blocks
 */
export function number<SRC extends IStringSource, A, PROBLEM>(args: {
  int: Results.Result<(n: number) => A, PROBLEM>;
  hex: Results.Result<(n: number) => A, PROBLEM>;
  octal: Results.Result<(n: number) => A, PROBLEM>;
  binary: Results.Result<(n: number) => A, PROBLEM>;
  float: Results.Result<(n: number) => A, PROBLEM>;
  invalid: PROBLEM;
  expecting: PROBLEM;
}): Parser<SRC, A, never, PROBLEM> {
  return new ParserImpl(async (s) => {
    // 0x30 => 0
    if (s.src.isCharCode(0x30, s.offset)) {
      const zeroOffset = s.offset + 1;
      const baseOffset = zeroOffset + 1;

      // 0x78 => x
      if (s.src.isCharCode(0x78, zeroOffset)) {
        // HEX
        return finalizeInt(
          args.invalid,
          args.hex,
          baseOffset,
          await s.src.consumeBase16(baseOffset),
          s
        );

        // 0x6f => o
      } else if (s.src.isCharCode(0x6f, zeroOffset)) {
        // OCTAL
        return finalizeInt(
          args.invalid,
          args.octal,
          baseOffset,
          await s.src.consumeBase(8, baseOffset),
          s
        );
        // 0x62 => b
      } else if (s.src.isCharCode(0x62, zeroOffset)) {
        // BINARY
        return finalizeInt(
          args.invalid,
          args.binary,
          baseOffset,
          await s.src.consumeBase(2, baseOffset),
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
      await s.src.consumeBase(10, s.offset),
      s
    );
  });
}

function finalizeInt<SRC extends IStringSource, A, PROBLEM>(
  invalid: PROBLEM,
  handler: Results.Result<(n: number) => A, PROBLEM>,
  startOffset: number,
  [endOffset, n]: [number, number],
  s: State<SRC, unknown>
): PStep<SRC, A, never, PROBLEM> {
  if (Results.isErr(handler)) {
    return Bad(true, fromState(s, handler.value));
  } else {
    if (startOffset === endOffset) {
      return Bad(s.offset < startOffset, fromState(s, invalid));
    } else {
      return Good(true, handler.value(n), bumpOffset(endOffset, s));
    }
  }
}

function bumpOffset<SRC extends IStringSource, CTX>(
  newOffset: number,
  s: State<SRC, CTX>
): State<SRC, CTX> {
  return {
    src: s.src,
    offset: newOffset,
    indent: s.indent,
    context: s.context,
    row: s.row,
    col: s.col + (newOffset - s.offset),
  };
}

function finalizeFloat<SRC extends IStringSource, A, PROBLEM>(
  invalid: PROBLEM,
  expecting: PROBLEM,
  intSettings: Results.Result<(n: number) => A, PROBLEM>,
  floatSettings: Results.Result<(n: number) => A, PROBLEM>,
  floatPair: [number, number],
  s: State<SRC, unknown>
): PStep<SRC, A, never, PROBLEM> {
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
    if (Results.isErr(floatSettings)) {
      return Bad(true, fromState(s, floatSettings.value));
    } else {
      try {
        const n = parseFloat(s.src.slice(s.offset, floatOffset));
        return Good(true, floatSettings.value(n), bumpOffset(floatOffset, s));
      } catch (e) {
        return Bad(true, fromState(s, invalid));
      }
    }
  }
}

/**
 * On a failure, returns negative index of problem.
 *
 */
function consumeDotAndExp<SRC extends IStringSource>(
  offset: number,
  src: SRC
): number {
  // 0x2e => '.'
  if (src.isCharCode(0x2e, offset)) {
    return consumeExp(src.chompBase10(offset + 1), src);
  } else {
    return consumeExp(offset, src);
  }
}

/**
 * On a failure, returns a negative index of the problem.
 *
 */
function consumeExp<SRC extends IStringSource>(
  offset: number,
  src: SRC
): number {
  // 0x65 => 'e'
  // 0x45 => 'E'
  if (src.isCharCode(0x65, offset) || src.isCharCode(0x45, offset)) {
    const eOffset = offset + 1;
    // 0x2b => '+'
    // 0x2d => '-'
    const expOffset =
      src.isCharCode(0x2b, offset) || src.isCharCode(0x2d, offset)
        ? eOffset + 1
        : eOffset;

    const newOffset = src.chompBase10(expOffset);
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
 * Just like {@link Simple!end | Simple.end} except you provide the problem that
 * arises when the parser is not at the end of the input.
 *
 * @category Building Blocks
 */
export const end = <SRC extends ISource<any, any>, PROBLEM>(
  problem: PROBLEM
): Parser<SRC, Unit, never, PROBLEM> => {
  return new ParserImpl((s) => {
    if (s.src.isEnd(s.offset)) {
      return Good(false, Unit, s);
    } else {
      return Bad(false, fromState(s, problem));
    }
  });
};

// CHOMPED STRINGS

/**
 * Just like {@link Simple!getChompedString | Simple.getChompedString}
 *
 * @see
 * - {@link mapChompedString}
 *
 * @category Chompers
 */
export const getChompedString = <
  SRC extends ISource<any, any>,
  A,
  CTX,
  PROBLEM
>(
  parser: Parser<SRC, A, CTX, PROBLEM>
): Parser<SRC, string, CTX, PROBLEM> => {
  return mapChompedString((a) => a)(parser);
};

/**
 * Just like {@link Simple!mapChompedString | Simple.mapChompedString}
 *
 * @see
 * - {@link getChompedString}
 *
 * @category Chompers
 */
export const mapChompedString =
  <A, B>(fn: (s: string, v: A) => B) =>
  <SRC extends ISource<any, any>, CTX, PROBLEM>(
    parser: Parser<SRC, A, CTX, PROBLEM>
  ): Parser<SRC, B, CTX, PROBLEM> => {
    return new ParserImpl(async (s) => {
      const res = await parser.exec(s);
      if (isBad(res)) {
        return res;
      } else {
        return Good(
          res.haveConsumed,
          fn(s.src.slice(s.offset, res.state.offset), res.value),
          res.state
        );
      }
    });
  };

// CHOMP IF

/**
 * Just like {@link Simple!chompIf | Simple.chompIf} except you provide a problem
 * in case a character cannot be chomped.
 *
 * @category Chompers
 */
export const chompIf =
  <TOKEN>(isGood: (token: TOKEN) => boolean) =>
  <SRC extends ISource<TOKEN, any>, PROBLEM>(
    expecting: PROBLEM
  ): Parser<SRC, Unit, never, PROBLEM> => {
    return new ParserImpl(async (s) => {
      const newOffset = await s.src.isSubToken(isGood, s.offset);
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

type ChompWhile = {
  <SRC extends ISource<TOKEN, any>, TOKEN, A>(
    isGood: (token: TOKEN, state: A) => [boolean, A],
    init: A
  ): Parser<SRC, Unit, never, never>;
  <SRC extends ISource<TOKEN, any>, TOKEN>(
    isGood: (token: TOKEN) => boolean
  ): Parser<SRC, Unit, never, never>;
};

/**
 * Just like {@link Simple!chompWhile | Simple.chompWhile}
 *
 * @category Chompers
 */
export const chompWhile: ChompWhile = <SRC extends ISource<TOKEN, any>, TOKEN>(
  isGood: any,
  init?: any
): Parser<SRC, Unit, never, never> => {
  return new ParserImpl((s) =>
    chompWhileHelp(isGood, init, s.offset, s.row, s.col, s)
  );
};

type ChompWhile1 = {
  <SRC extends ISource<TOKEN, any>, TOKEN, PROBLEM, A>(
    problem: PROBLEM,
    isGood: (char: string, state: A) => [boolean, A],
    init: A
  ): Parser<SRC, Unit, never, PROBLEM>;
  <SRC extends ISource<TOKEN, any>, TOKEN, PROBLEM>(
    problem: PROBLEM,
    isGood: (char: string) => boolean
  ): Parser<SRC, Unit, never, PROBLEM>;
};

/**
 * Just like {@link Simple!chompWhile1 | Simple.chompWhile1}
 *
 * @category Chompers
 */
export const chompWhile1: ChompWhile1 = <
  SRC extends ISource<TOKEN, any>,
  TOKEN,
  PROBLEM
>(
  problem: PROBLEM,
  isGood: any,
  init?: any
): Parser<SRC, Unit, never, PROBLEM> => {
  return new ParserImpl((s) =>
    chompWhileHelp(isGood, init, s.offset, s.row, s.col, s, {
      chompMinOneProblem: problem,
    })
  );
};

async function chompWhileHelp<
  SRC extends ISource<TOKEN, any>,
  TOKEN,
  A,
  PROBLEM
>(
  isGood:
    | ((token: TOKEN) => boolean)
    | ((token: TOKEN, state: A) => [boolean, A]),
  init: any,
  offset: number,
  row: number,
  col: number,
  s0: State<SRC, unknown>,
  config?: {
    chompMinOneProblem: PROBLEM;
  }
): Promise<PStep<SRC, Unit, never, PROBLEM>> {
  let finalOffset = offset;
  let finalRow = row;
  let finalCol = col;

  let state = init;

  const fn =
    isGood.length === 1
      ? (isGood as (token: TOKEN) => boolean)
      : (token: TOKEN) => {
          // @ts-ignore
          const [returnVal, newState] = isGood(char, state);
          state = newState;
          return returnVal;
        };

  let iterations = 0;

  let newOffset = await s0.src.isSubToken(fn, offset);
  while (newOffset !== -1) {
    iterations++;
    if (newOffset === -2) {
      finalOffset = finalOffset + 1;
      finalRow = finalRow + 1;
      finalCol = 1;
    } else {
      finalOffset = newOffset;
      finalCol = finalCol + 1;
    }

    newOffset = await s0.src.isSubToken(fn, finalOffset);
  }

  if (iterations < 1 && config) {
    return Bad(false, fromState(s0, config.chompMinOneProblem));
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
 * Just like {@link Simple!chompUntil | Simple.chompUntil} except you provide a
 * `Token` in case you chomp to the end of the input without finding
 * what you need.
 *
 * @category Chompers
 */
export const chompUntil = <SRC extends ISource<any, CHUNK>, CHUNK, PROBLEM>(
  token: Token<CHUNK, PROBLEM>
): Parser<SRC, Unit, never, PROBLEM> => {
  return new ParserImpl(async (s) => {
    const [newOffset, newRow, newCol] = await s.src.findSubChunk(
      token.value,
      s.offset,
      s.row,
      s.col
    );
    if (newOffset === -1) {
      return Bad(false, fromInfo(newRow, newCol, token.problem, s.context));
    } else {
      const [finalOffset, finalRow, finalCol] = await s.src.isSubChunk(
        token.value,
        newOffset,
        newRow,
        newCol
      );
      return Good(s.offset < newOffset, Unit, {
        src: s.src,
        offset: finalOffset,
        indent: s.indent,
        context: s.context,
        row: finalRow,
        col: finalCol,
      });
    }
  });
};

/**
 * Just like {@link Simple!chompUntilEndOr | Simple.chompUntilEndOr}
 *
 * @category Chompers
 */
export const chompUntilEndOr = <SRC extends ISource<any, CHUNK>, CHUNK>(
  chunk: CHUNK
): Parser<SRC, Unit, never, never> => {
  return new ParserImpl(async (s) => {
    const [newOffset, newRow, newCol] = await s.src.findSubChunk(
      chunk,
      s.offset,
      s.row,
      s.col
    );
    const [finalOffset, finalRow, finalCol] = await s.src.isSubChunk(
      chunk,
      newOffset,
      newRow,
      newCol
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
 *
 * @privateRemarks
 * We will not add this to the Parser interface since that will make `CTX` leak
 * into the Simple module.
 *
 * @category Parsers
 */
export const inContext =
  <CTX>(ctx: CTX) =>
  <SRC extends ISource<any, any>, A, PROBLEM>(
    parser: Parser<SRC, A, CTX, PROBLEM>
  ): Parser<SRC, A, CTX, PROBLEM> => {
    return new ParserImpl(async (s0) => {
      // This must use a immutable list!!!
      const res = await parser.exec(
        changeContext(
          s0.context.push({ context: ctx, row: s0.row, col: s0.col }),
          s0
        )
      );

      if (isGood(res)) {
        return Good(
          res.haveConsumed,
          res.value,
          changeContext(s0.context, res.state)
        );
      } else {
        return res;
      }
    });
  };

function changeContext<SRC extends ISource<any, any>, CTX>(
  newContext: immutable.Stack<Located<CTX>>,
  { context, ...rest }: State<SRC, unknown>
): State<SRC, CTX> {
  return {
    context: newContext,
    ...rest,
  };
}

// INDENTATION

/**
 * Just like {@link Simple!getIndent | Simple.getIndent}
 *
 * @category Indentation
 */
export const getIndent: Parser<
  ISource<any, any>,
  number,
  never,
  never
> = new ParserImpl<ISource<any, any>, number, never, never>(
  async (
    s: State<ISource<any, any>, never>
  ): Promise<PStep<ISource<any, any>, number, never, never>> =>
    Good(false, s.indent, s)
);

/**
 * Just like {@link Simple!withIndent | Simple.withIndent}
 *
 * @category Indentation
 */
export const withIndent = (newIndent: number) => {
  if (newIndent < 0) {
    throw Error(`Indentation was smaller then 1, value: ${newIndent}`);
  }
  return <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
    parse: Parser<SRC, A, CTX, PROBLEM>
  ): Parser<SRC, A, CTX, PROBLEM> => {
    return new ParserImpl(async (s) => {
      const res = await parse.exec(changeIndent(newIndent + s.indent, s));
      if (isGood(res)) {
        return Good(
          res.haveConsumed,
          res.value,
          changeIndent(s.indent, res.state)
        );
      } else {
        return res;
      }
    });
  };
};

function changeIndent<SRC extends ISource<any, any>, CTX>(
  newIndent: number,
  { indent, ...rest }: State<SRC, CTX>
): State<SRC, CTX> {
  return {
    indent: newIndent, // we must remove one so that that withIndent(4) => 4 and not 5
    ...rest,
  };
}

// Optional

/**
 * Just like {@link Simple!optional | Simple.optional}
 *
 * @category Branches
 */
export const optional = <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  parser: Parser<SRC, A, CTX, PROBLEM>
): Parser<SRC, A | undefined, CTX, PROBLEM> => {
  return parser.or(succeed(undefined));
};

// SYMBOL

/**
 *
 * Just like {@link Simple!symbol | Simple.symbol} except you provide a `Token` to
 * indicate your custom type of problems:
 *
 * ```ts
 * const comma: Parser<Unit, Problem> = symbol(Token("," ExpectingComma))
 * ```
 *
 * @see
 * - {@link token}
 *
 * @category Building Blocks
 */
export const symbol = token;

// KEYWORD

/**
 * Just like {@link Simple!keyword | Simple.keyword} except you provide a `Token`
 * to clearly indicate your custom type of problems:
 *
 * ```ts
 *      const myLet = keyword(Token("let", ExpectingLet))
 * ```
 *
 * Note that this would fail to chomp `letter` because of the subsequent
 * characters. Use `token` if you do not want that last letter checked.
 *
 * @category Building Blocks
 */
export const keyword = <SRC extends ISource<any, string>, PROBLEM>(
  token: Token<string, PROBLEM>
): Parser<SRC, Unit, never, PROBLEM> => {
  const kwd = token.value;

  const progress = kwd.length > 0;

  return new ParserImpl(async (s) => {
    const [newOffset, newRow, newCol] = await s.src.isSubChunk(
      kwd,
      s.offset,
      s.row,
      s.col
    );

    if (
      newOffset === -1 ||
      0 <=
        (await s.src.isSubToken(
          (c) => Helpers.isAlphaNum(c) || c === "_",
          newOffset
        ))
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
// TODO: Remove the unnecessary promises. It causes unnecessary allocations.

/**
 *  Just like {@link Simple!getPosition | Simple.getPositions}
 *
 * @category Positions
 */
export const getPosition: Parser<any, [number, number], never, never> =
  new ParserImpl(
    async (
      s: State<any, unknown>
    ): Promise<PStep<any, [number, number], never, never>> =>
      Good(false, [s.row, s.col], s)
  );

/**
 * Just like {@link Simple!getRow | Simple.getRow}
 *
 * @category Positions
 */
export const getRow: Parser<any, number, never, never> = new ParserImpl(
  async (s: State<any, unknown>): Promise<PStep<any, number, never, never>> =>
    Good(false, s.row, s)
);

/**
 * Just like {@link Simple!getCol | Simple.getCol}
 *
 * @category Positions
 */
export const getCol: Parser<any, number, never, never> = new ParserImpl(
  async (s: State<any, unknown>): Promise<PStep<any, number, never, never>> =>
    Good(false, s.col, s)
);

/**
 * Just like {@link Simple!getOffset | Simple.getOffset}
 *
 * @category Positions
 */
export const getOffset: Parser<any, number, never, never> = new ParserImpl(
  async (s: State<any, unknown>): Promise<PStep<any, number, never, never>> =>
    Good(false, s.offset, s)
);

/**
 * TODO: This is not implemented yet.
 *
 * Just like {@link Simple!getSource | Simple.getSource}
 *
 * @category Positions
 */
export const getSource = new ParserImpl(
  async <SRC extends ISource<any, CHUNK>, CHUNK>(
    s: State<SRC, unknown>
  ): Promise<PStep<SRC, SRC, never, never>> => Good(false, s.src, s)
);

// VARIABLES

/**
 * Just like {@link Simple!variable | Simple.variable} except you specify the
 * problem yourself.
 *
 * @category Building Blocks
 */
export const variable = <TOKEN, PROBLEM>(args: {
  start: (char: TOKEN) => boolean;
  inner: (char: TOKEN) => boolean;
  reserved: Set<string>;
  expecting: PROBLEM;
}): Parser<ISource<TOKEN, any>, string, never, PROBLEM> => {
  return new ParserImpl(async (s) => {
    const firstOffset = await s.src.isSubToken(args.start, s.offset);

    if (firstOffset === -1) {
      return Bad(false, fromState(s, args.expecting));
    }

    const s1 =
      firstOffset === -2
        ? await varHelp(
            args.inner,
            s.offset + 1,
            s.row + 1,
            1,
            s.src,
            s.indent,
            s.context
          )
        : await varHelp(
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

const varHelp = async <SRC extends ISource<TOKEN, any>, TOKEN, CTX>(
  isGood: (s: TOKEN) => boolean,
  offset: number,
  row: number,
  col: number,
  src: SRC,
  indent: number,
  context: immutable.Stack<Located<CTX>>
): Promise<State<SRC, CTX>> => {
  let currentOffset = offset;
  let currentRow = row;
  let currentCol = col;

  while (true) {
    const newOffset = await src.isSubToken(isGood, currentOffset);
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
 * Just like {@link Simple!sequence | Simple.sequence} except with a `Token` for
 * the start, separator, and end. That way you can specify your custom type of
 * problem for when something is not found.
 *
 * @category Loops
 * @category Sequence (All)
 */
export const sequence = <
  SRC extends ISource<any, CHUNK>,
  CHUNK,
  A,
  CTX1,
  CTX2,
  PROBLEM1,
  PROBLEM2,
  PROBLEM3,
  PROBLEM4,
  PROBLEM5
>(args: {
  start: Token<CHUNK, PROBLEM1>;
  separator: Token<CHUNK, PROBLEM2>;
  end: Token<CHUNK, PROBLEM3>;
  spaces: Parser<SRC, Unit, CTX1, PROBLEM4>;
  item: Parser<SRC, A, CTX2, PROBLEM5>;
  trailing: Trailing;
}): Parser<
  SRC,
  immutable.List<A>,
  CTX1 | CTX2,
  PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4 | PROBLEM5
> => {
  return succeed(Unit)
    .skip(token(args.start))
    .skip(args.spaces)
    .keep(
      sequenceEnd<
        SRC,
        A,
        CTX1 | CTX2,
        PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4 | PROBLEM5
      >(
        token(args.end),
        args.spaces,
        args.item,
        token(args.separator),
        args.trailing
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

const sequenceEnd = <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  ender: Parser<SRC, Unit, CTX, PROBLEM>,
  ws: Parser<SRC, Unit, CTX, PROBLEM>,
  parseItem: Parser<SRC, A, CTX, PROBLEM>,
  sep: Parser<SRC, Unit, CTX, PROBLEM>,
  trailing: Trailing
): Parser<SRC, immutable.List<A>, CTX, PROBLEM> => {
  const chompRest = (item: A) => {
    const init = immutable.List([item]);
    if (trailing === Trailing.Forbidden) {
      return loop(init)(sequenceEndForbidden(ender, ws, parseItem, sep));
    } else if (trailing === Trailing.Optional) {
      return loop(init)(sequenceEndOptional(ender, ws, parseItem, sep));
    } else {
      return succeed(Unit)
        .skip(ws)
        .skip(sep)
        .skip(ws)
        .keep(loop(init)(sequenceEndMandatory(ws, parseItem, sep)))
        .skip(ender);
    }
  };
  return oneOf(
    parseItem.andThen(chompRest),
    ender.map(() => immutable.List())
  );
};

const sequenceEndForbidden =
  <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
    ender: Parser<SRC, Unit, CTX, PROBLEM>,
    ws: Parser<SRC, Unit, CTX, PROBLEM>,
    parseItem: Parser<SRC, A, CTX, PROBLEM>,
    sep: Parser<SRC, Unit, CTX, PROBLEM>
  ) =>
  (
    state: immutable.List<A>
  ): Parser<SRC, Step<immutable.List<A>, immutable.List<A>>, CTX, PROBLEM> => {
    return succeed(Unit)
      .skip(ws)
      .keep(
        oneOf(
          succeed((item: A) => Loop(state.push(item)))
            .skip(sep)
            .skip(ws)
            .apply(parseItem),
          succeed(Done(state)).skip(ender)
        )
      );
  };

const sequenceEndOptional =
  <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
    ender: Parser<SRC, Unit, CTX, PROBLEM>,
    ws: Parser<SRC, Unit, CTX, PROBLEM>,
    parseItem: Parser<SRC, A, CTX, PROBLEM>,
    sep: Parser<SRC, Unit, CTX, PROBLEM>
  ) =>
  (
    state: immutable.List<A>
  ): Parser<SRC, Step<immutable.List<A>, immutable.List<A>>, CTX, PROBLEM> => {
    return succeed(Unit)
      .skip(ws)
      .keep(
        oneOf(
          succeed(Unit)
            .skip(sep)
            .skip(ws)
            .keep(
              oneOf(
                succeed((item: A) => Loop(state.push(item))).apply(parseItem),
                succeed(Done(state)).skip(ender)
              )
            ),
          succeed(Done(state)).skip(ender)
        )
      );
  };

const sequenceEndMandatory =
  <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
    ws: Parser<SRC, Unit, CTX, PROBLEM>,
    parseItem: Parser<SRC, A, CTX, PROBLEM>,
    sep: Parser<SRC, Unit, CTX, PROBLEM>
  ) =>
  (
    state: immutable.List<A>
  ): Parser<SRC, Step<immutable.List<A>, immutable.List<A>>, CTX, PROBLEM> => {
    return oneOf(
      succeed((item: A) => Loop(state.push(item)))
        .apply(parseItem)
        .skip(ws)
        .skip(sep)
        .skip(ws),
      succeed(Done(state))
    );
  };

// MANY

/**
 * Just like {@link Simple!many | Simple.many}
 *
 * @category Loops
 */
export const many = <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  parseItem: Parser<SRC, A, CTX, PROBLEM>
): Parser<SRC, A[], CTX, PROBLEM> => {
  return loop<immutable.List<A>>(immutable.List())(manyHelp(parseItem)).map(
    (xs) => xs.toArray()
  );
};

const manyHelp =
  <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
    parseItem: Parser<SRC, A, CTX, PROBLEM>
  ) =>
  (
    state: immutable.List<A>
  ): Parser<SRC, Step<immutable.List<A>, immutable.List<A>>, CTX, PROBLEM> => {
    return oneOf(
      parseItem.map((item) => Loop(state.push(item))),
      succeed(Unit).map(() => Done(state))
    );
  };

// MANY1

/**
 * Just like {@link Simple!many1 | Simple.many1} but you
 * provide the problem yourself.
 *
 * @category Loops
 */
export const many1 = <SRC extends ISource<any, any>, A, CTX, PROBLEM>(
  parseItem: Parser<SRC, A, CTX, PROBLEM>,
  p: PROBLEM
): Parser<SRC, A[], CTX, PROBLEM> => {
  return many(parseItem).andThen((items) =>
    items.length === 0 ? problem(p) : succeed(items)
  );
};

// WHITESPACE

/**
 * Just like {@link Simple!spaces | Simple.spaces}
 *
 * @category Whitespace
 */
export const spaces: Parser<
  ISource<string, any>,
  Unit,
  never,
  never
> = new ParserImpl<ISource<string, any>, Unit, never, never>(
  (s: State<ISource<string, any>, unknown>) =>
    chompWhile<ISource<string, any>, string>(
      (c) => c === " " || c === "\n" || c === "\r"
    ).exec(s)
);

// LINE COMMENT

/**
 * Just like {@link Simple!lineComment | Simple.lineComment} except you provide a
 * `Token` describing the starting symbol.
 *
 * @category Whitespace
 */
export const lineComment = <PROBLEM>(
  start: Token<string, PROBLEM>
): Parser<ISource<string, any>, Unit, never, PROBLEM> =>
  skip2nd<ISource<string, any>, Unit, never, PROBLEM>(token(start))(
    chompUntilEndOr("\n")
  );

// Multiline Comment

/**
 * Help distinguish between un-nestable  `/*` `* /` comments like in JS and nestable `{-` `-}`
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
 * @category Multiline Comment (All)
 */
export function isNestable(x: any): x is typeof Nestable.Nestable {
  return x === Nestable.Nestable;
}

/**
 *
 * @category Multiline Comment (All)
 */
export function isNotNestable(x: any): x is typeof Nestable.NotNestable {
  return x === Nestable.NotNestable;
}

/**
 * Just like {@link Simple!multiComment | Simple.multiComment} except with a
 * `Token` for the open and close symbols.
 *
 * @category Whitespace
 * @category Multiline Comment (All)
 */
export const multiComment =
  <PROBLEM>(open: Token<string, PROBLEM>) =>
  (close: Token<string, PROBLEM>) =>
  (nestable: Nestable): Parser<ISource<any, string>, Unit, never, PROBLEM> => {
    if (isNotNestable(nestable)) {
      return skip2nd(token(open))(chompUntil(close));
    } else {
      return nestableComment<PROBLEM>(open, close);
    }
  };

function nestableComment<PROBELM>(
  open: Token<string, PROBELM>,
  close: Token<string, PROBELM>
): Parser<ISource<any, string>, Unit, never, PROBELM> {
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

function nestableHelp<CTX, PROBLEM>(
  isNotRelevant: (c: string) => boolean,
  open: Parser<ISource<any, string>, Unit, CTX, PROBLEM>,
  close: Parser<ISource<any, string>, Unit, CTX, PROBLEM>,
  expectingClose: PROBLEM,
  nestLevel: number
): Parser<ISource<any, string>, Unit, CTX, PROBLEM> {
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
