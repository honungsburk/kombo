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
import * as SRCTypes from "./Source/Types.js";

export const create = <CORE extends SRCTypes.HasCore<any, any, any>>(
  core: CORE
) => {
  return {
    // EXEC
    run: run,
    // PRIMITIVES
    succeed: succeed(core),
    problem: problem(core),
    // END
    end: end(core),
    // MAPPING
    map: map(core),
    map2: map2(core),
    apply: apply(core),
    skip1st: skip1st(core),
    skip2nd: skip2nd(core),
    // AND THEN
    andThen: andThen(core),
    // LAZY
    lazy: lazy(core),
    // ONE OF
    oneOf: oneOf(core),
    oneOfMany: oneOfMany(core),
    // MANY
    many: many(core),
    many1: many1(core),
    // LOOP
    loop: loop(core),
    Loop: Loop,
    Done: Done,
    // TOKENS
    symbol: symbol(core),
    token: token(core),
    Token: Token,
    // VARIABLE
    variable: variable(core),
    // CHOMP
    chompIf: chompIf(core),
    chompWhile: chompWhile(core),
    chompWhile1: chompWhile1(core),
    chompUntil: chompUntil(core),
    chompUntilEndOr: chompUntilEndOr(core),
    getChompedChunk: getChompedChunk(core),
    mapChompedChunk: mapChompedChunk(core),
    // BRANCHES
    optional: optional(core),
    backtrackable: backtrackable(core),
    // SEQUENCE
    sequence: sequence(core),
    Trailing: Trailing,
    // CONTEXT
    inContext: inContext(core),
    // INDENT
    getIndent: getIndent(core),
    withIndent: withIndent(core),
    // POSITION
    getPosition: getPosition(core),
    getRow: getRow(core),
    getCol: getCol(core),
    getOffset: getOffset(core),
    // SOURCE
    getSource: getSource(core),
  } as const;
};

export function string<
  CORE extends SRCTypes.HasCore<any, string, string> &
    SRCTypes.HasStringCore<any>
>(core: CORE) {
  return {
    keyword: keyword(core),
    spaces: spaces(core),
    int: int(core),
    float: float(core),
    number: number(core),
    lineComment: lineComment(core),
    multiComment: multiComment(core),
    Nestable: Nestable,
  } as const;
}

////////////////////////////////////////////////////////////////////////////////
// Internals
////////////////////////////////////////////////////////////////////////////////

/**
 * @hidden
 */
class ParserImpl<
  CORE extends SRCTypes.HasCore<any, any, any>,
  A,
  CTX = never,
  PROBLEM = never
> implements Parser<CORE, A, CTX, PROBLEM>
{
  constructor(
    private core: CORE,
    public exec: (
      s: State<SRCTypes.GetHasCoreSRC<CORE>, unknown>
    ) => Promise<PStep<SRCTypes.GetHasCoreSRC<CORE>, A, CTX, PROBLEM>>
  ) {}

  map<B>(fn: (v: A) => B): Parser<CORE, B, CTX, PROBLEM> {
    return map(this.core)(fn)(this as Parser<CORE, A, CTX, PROBLEM>);
  }

  andThen<B, CTX2, PROBLEM2>(
    fn: (v: A) => Parser<CORE, B, CTX2, PROBLEM2>
  ): Parser<CORE, B, CTX | CTX2, PROBLEM | PROBLEM2> {
    return andThen(this.core)(fn)(this as Parser<CORE, A, CTX, PROBLEM>);
  }

  skip<CTX2, PROBLEM2>(
    other: Parser<CORE, unknown, CTX2, PROBLEM2>
  ): Parser<CORE, A, CTX | CTX2, PROBLEM | PROBLEM2> {
    return skip2nd(this.core)(this)(other);
  }

  keep<B, CTX2, PROBLEM2>(
    other: Parser<CORE, B, CTX2, PROBLEM2>
  ): Parser<CORE, B, CTX | CTX2, PROBLEM | PROBLEM2> {
    return this.andThen(() => other);
  }

  apply<CTX2, PROBLEM2>(
    parser: Parser<CORE, GetArgumentType<A>, CTX2, PROBLEM2>
  ): Parser<CORE, GetReturnType<A>, CTX | CTX2, PROBLEM | PROBLEM2> {
    return apply(this.core)(
      this as Parser<
        CORE,
        (a: GetArgumentType<A>) => GetReturnType<A>,
        CTX | CTX2,
        PROBLEM
      >
    )(parser);
  }

  run(
    src: SRCTypes.GetHasCoreSRC<CORE>
  ): Promise<Results.Result<A, DeadEnd<CTX, PROBLEM>[]>> {
    return run(this as Parser<CORE, A, CTX, PROBLEM>)(src);
  }

  or<B, CTX2, PROBLEM2>(
    other: Parser<CORE, B, CTX2, PROBLEM2>
  ): Parser<CORE, A | B, CTX | CTX2, PROBLEM | PROBLEM2> {
    return oneOf(this.core)(this as Parser<CORE, A, CTX, PROBLEM>, other);
  }

  optional(): Parser<CORE, A | undefined, CTX, PROBLEM> {
    return optional(this.core)(this as Parser<CORE, A, CTX, PROBLEM>);
  }

  backtrackable(): Parser<CORE, A, CTX, PROBLEM> {
    return backtrackable(this.core)(this as Parser<CORE, A, CTX, PROBLEM>);
  }

  getChompedChunk(): Parser<
    CORE,
    SRCTypes.GetHasCoreCHUNK<CORE>,
    CTX,
    PROBLEM
  > {
    return getChompedChunk(this.core)(this as Parser<CORE, A, CTX, PROBLEM>);
  }

  mapChompedChunk<B>(
    fn: (s: SRCTypes.GetHasCoreCHUNK<CORE>, v: A) => B
  ): Parser<CORE, B, CTX, PROBLEM> {
    return mapChompedChunk(this.core)(fn)(
      this as Parser<CORE, A, CTX, PROBLEM>
    );
  }

  getIndent(): Parser<CORE, number, CTX, PROBLEM> {
    return this.keep(getIndent(this.core));
  }

  withIndent(newIndent: number): Parser<CORE, A, CTX, PROBLEM> {
    return withIndent(this.core)(newIndent)(this);
  }

  getPosition(): Parser<CORE, [number, number], CTX, PROBLEM> {
    return this.keep(getPosition(this.core));
  }
  getRow(): Parser<CORE, number, CTX, PROBLEM> {
    return this.keep(getRow(this.core));
  }
  getCol(): Parser<CORE, number, CTX, PROBLEM> {
    return this.keep(getCol(this.core));
  }
  getOffset(): Parser<CORE, number, CTX, PROBLEM> {
    return this.keep(getOffset(this.core));
  }
  getSource(): Parser<CORE, SRCTypes.GetHasCoreSRC<CORE>, CTX, PROBLEM> {
    return this.keep(getSource(this.core));
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
  <CORE extends SRCTypes.HasCore<any, any, any>, A, CTX, PROBLEM>(
    parser: Parser<CORE, A, CTX, PROBLEM>
  ) =>
  async (
    src: SRCTypes.GetHasCoreSRC<CORE>
  ): Promise<Results.Result<A, DeadEnd<CTX, PROBLEM>[]>> => {
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
export const succeed =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A>(a: A): Parser<CORE, A, never, never> => {
    return new ParserImpl(core, async (s) => Good(false, a, s));
  };

/**
 *
 * Just like {@link Simple!problem | Simple.problem} except you provide a custom
 * type for your problem.
 *
 * @category Primitives
 */
export const problem =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <PROBLEM>(p: PROBLEM): Parser<CORE, never, never, PROBLEM> => {
    return new ParserImpl(core, async (s) => Bad(false, fromState(s, p)));
  };

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
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, B>(fn: (a: A) => B) =>
  <CTX, PROBLEM>(
    parser: Parser<CORE, A, CTX, PROBLEM>
  ): Parser<CORE, B, CTX, PROBLEM> => {
    return new ParserImpl(core, async (s) => {
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
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, B, C>(fn: (a: A, b: B) => C) =>
  <CTX, PROBLEM>(parserA: Parser<CORE, A, CTX, PROBLEM>) =>
  <CTX2, PROBLEM2>(
    parserB: Parser<CORE, B, CTX2, PROBLEM2>
  ): Parser<CORE, C, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return new ParserImpl(
      core,
      async (
        s0
      ): Promise<
        PStep<SRCTypes.GetHasCoreSRC<CORE>, C, CTX | CTX2, PROBLEM | PROBLEM2>
      > => {
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
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, B, CTX, PROBLEM>(parseFunc: Parser<CORE, (a: A) => B, CTX, PROBLEM>) =>
  <CTX2, PROBLEM2>(
    parseArg: Parser<CORE, A, CTX2, PROBLEM2>
  ): Parser<CORE, B, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return map2<CORE>(core)((fn: (a: A) => B, arg: A) => fn(arg))(parseFunc)(
      parseArg
    );
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
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <CTX, PROBLEM>(first: Parser<CORE, unknown, CTX, PROBLEM>) =>
  <A, CTX2, PROBLEM2>(
    second: Parser<CORE, A, CTX2, PROBLEM2>
  ): Parser<CORE, A, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return map2(core)((a, b: A) => b)(first)(second);
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
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(keepParser: Parser<CORE, A, CTX, PROBLEM>) =>
  <CTX2, PROBLEM2>(
    ignoreParser: Parser<CORE, unknown, CTX2, PROBLEM2>
  ): Parser<CORE, A, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return map2(core)((a: A, b) => a)(keepParser)(ignoreParser);
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
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, B, CTX, PROBLEM>(fn: (a: A) => Parser<CORE, B, CTX, PROBLEM>) =>
  <CTX2, PROBLEM2>(
    p: Parser<CORE, A, CTX2, PROBLEM2>
  ): Parser<CORE, B, CTX | CTX2, PROBLEM | PROBLEM2> => {
    return new ParserImpl(
      core,
      async (
        state
      ): Promise<
        PStep<SRCTypes.GetHasCoreSRC<CORE>, B, CTX | CTX2, PROBLEM | PROBLEM2>
      > => {
        const res1 = await p.exec(state);

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
export const lazy =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    thunk: () => Parser<CORE, A, CTX, PROBLEM>
  ): Parser<CORE, A, CTX, PROBLEM> => {
    return new ParserImpl(core, (ctx) => {
      return thunk().exec(ctx);
    });
  };

// ONE OF

interface OneOf<CORE extends SRCTypes.HasCore<any, any, any>> {
  // ONE
  <A, CTX, PROBLEM>(one: Parser<CORE, A, CTX, PROBLEM>): Parser<
    CORE,
    A,
    CTX,
    PROBLEM
  >;
  // TWO
  <A, B, CTX1, CTX2, PROBLEM1, PROBLEM2>(
    one: Parser<CORE, A, CTX1, PROBLEM1>,
    two: Parser<CORE, B, CTX2, PROBLEM2>
  ): Parser<CORE, A | B, CTX1 | CTX2, PROBLEM1 | PROBLEM2>;
  // THREE
  <A, B, C, CTX1, CTX2, CTX3, PROBLEM1, PROBLEM2, PROBLEM3>(
    one: Parser<CORE, A, CTX1, PROBLEM1>,
    two: Parser<CORE, B, CTX2, PROBLEM2>,
    three: Parser<CORE, C, CTX3, PROBLEM3>
  ): Parser<
    CORE,
    A | B | C,
    CTX1 | CTX2 | CTX3,
    PROBLEM1 | PROBLEM2 | PROBLEM3
  >;
  // FOUR
  <A, B, C, D, CTX1, CTX2, CTX3, CTX4, PROBLEM1, PROBLEM2, PROBLEM3, PROBLEM4>(
    one: Parser<CORE, A, CTX1, PROBLEM1>,
    two: Parser<CORE, B, CTX2, PROBLEM2>,
    three: Parser<CORE, C, CTX3, PROBLEM3>,
    four: Parser<CORE, D, CTX4, PROBLEM4>
  ): Parser<
    CORE,
    A | B | C | D,
    CTX1 | CTX2 | CTX3 | CTX4,
    PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4
  >;
  // FIVE
  <
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
    one: Parser<CORE, A, CTX1, PROBLEM1>,
    two: Parser<CORE, B, CTX2, PROBLEM2>,
    three: Parser<CORE, C, CTX3, PROBLEM3>,
    four: Parser<CORE, D, CTX4, PROBLEM4>,
    five: Parser<CORE, E, CTX5, PROBLEM5>
  ): Parser<
    CORE,
    A | B | C | D | E,
    CTX1 | CTX2 | CTX3 | CTX4 | CTX5,
    PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4 | PROBLEM5
  >;
}

/**
 * Just like {@link Simple!oneOf | Simple.oneOf}
 *
 * @see
 * - {@link Parser!Parser.or | Parser.or} is the infix version of `oneOf`
 * - {@link oneOfMany | Advanced.oneOfMany} for when you need to choose between more than 5 parsers.
 *
 * @category Branches
 */
export const oneOf =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE): OneOf<CORE> =>
  <A, CTX, PROBLEM>(
    ...parsers: Parser<CORE, A, CTX, PROBLEM>[]
  ): Parser<CORE, A, CTX, PROBLEM> => {
    return oneOfMany(core)(...parsers);
  };

/**
 * Just like {@link Simple!oneOfMany | Simple.oneOfMany}
 *
 * @see
 * - For better type inference checkout {@link oneOf | Advanced.oneOf}
 *
 * @category Branches
 */
export const oneOfMany =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    ...parsers: Parser<CORE, A, CTX, PROBLEM>[]
  ): Parser<CORE, A, CTX, PROBLEM> => {
    return new ParserImpl(core, (ctx) => oneOfHelp(ctx, Empty, parsers));
  };

async function oneOfHelp<
  CORE extends SRCTypes.HasCore<any, any, any>,
  A,
  CTX,
  PROBLEM
>(
  ctx0: State<SRCTypes.GetHasCoreSRC<CORE>, unknown>,
  bag: Bag<CTX, PROBLEM>,
  parsers: Parser<CORE, A, CTX, PROBLEM>[]
): Promise<PStep<SRCTypes.GetHasCoreSRC<CORE>, A, CTX, PROBLEM>> {
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
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <STATE>(state: STATE) =>
  <A, CTX, PROBLEM>(
    fn: (state: STATE) => Parser<CORE, Step<STATE, A>, CTX, PROBLEM>
  ): Parser<CORE, A, CTX, PROBLEM> => {
    return new ParserImpl(core, (s) => loopHelp(state, fn, s));
  };

const loopHelp = async <
  CORE extends SRCTypes.HasCore<any, any, any>,
  STATE,
  A,
  CTX,
  PROBLEM
>(
  state: STATE,
  fn: (state: STATE) => Parser<CORE, Step<STATE, A>, CTX, PROBLEM>,
  s: State<SRCTypes.GetHasCoreSRC<CORE>, CTX>
): Promise<PStep<SRCTypes.GetHasCoreSRC<CORE>, A, CTX, PROBLEM>> => {
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
export const backtrackable =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    parser: Parser<CORE, A, CTX, PROBLEM>
  ): Parser<CORE, A, CTX, PROBLEM> => {
    return new ParserImpl(core, async (ctx) => {
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
export const commit =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A>(a: A): Parser<CORE, A, never, never> => {
    return new ParserImpl(core, async (s) => Good(true, a, s));
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
export const token =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <PROBLEM>(
    token: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBLEM>
  ): Parser<CORE, Unit, never, PROBLEM> => {
    return new ParserImpl(core, async (s) => {
      const [newOffset, newRow, newCol] = await core.isSubChunk(
        token.value,
        s.offset,
        s.row,
        s.col,
        s.src
      );

      if (newOffset === -1) {
        return Bad(false, fromState(s, token.problem));
      } else {
        // NOTE: I changed "token.value.length !== 0" to "s.offset !== newOffset"
        // because I think it should be impossible for the offset to not change
        // when the token is non-empty. But I'm not 100% sure.
        //
        // TODO: Add a test for this.
        return Good(s.offset !== newOffset, Unit, {
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
  <CORE extends SRCTypes.HasCore<any, any, any> & SRCTypes.HasStringCore<any>>(
    core: CORE
  ) =>
  <PROBLEM>(expecting: PROBLEM) =>
  (invalid: PROBLEM): Parser<CORE, number, never, PROBLEM> => {
    return number(core)({
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
  <CORE extends SRCTypes.HasCore<any, any, any> & SRCTypes.HasStringCore<any>>(
    core: CORE
  ) =>
  <PROBLEM>(expecting: PROBLEM) =>
  (invalid: PROBLEM): Parser<CORE, number, never, PROBLEM> => {
    return number(core)({
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
export const number =
  <CORE extends SRCTypes.HasCore<any, any, any> & SRCTypes.HasStringCore<any>>(
    core: CORE
  ) =>
  <A, PROBLEM>(args: {
    int: Results.Result<(n: number) => A, PROBLEM>;
    hex: Results.Result<(n: number) => A, PROBLEM>;
    octal: Results.Result<(n: number) => A, PROBLEM>;
    binary: Results.Result<(n: number) => A, PROBLEM>;
    float: Results.Result<(n: number) => A, PROBLEM>;
    invalid: PROBLEM;
    expecting: PROBLEM;
  }): Parser<CORE, A, never, PROBLEM> => {
    // GetHasCoreSRC<CORE> is always the same as GetHasStringCoreSRC<CORE> but
    // typescript doesn't know that. So we have to cast it.
    //
    // @ts-ignore
    return new ParserImpl(core, async (s) => {
      // 0x30 => 0
      if (core.isCharCode(0x30, s.offset, s.src)) {
        const zeroOffset = s.offset + 1;
        const baseOffset = zeroOffset + 1;

        // 0x78 => x
        if (core.isCharCode(0x78, zeroOffset, s.src)) {
          // HEX
          return finalizeInt(
            args.invalid,
            args.hex,
            baseOffset,
            await core.consumeBase16(baseOffset, s.src),
            s
          );

          // 0x6f => o
        } else if (core.isCharCode(0x6f, zeroOffset, s.src)) {
          // OCTAL
          return finalizeInt(
            args.invalid,
            args.octal,
            baseOffset,
            await core.consumeBase(8, baseOffset, s.src),
            s
          );
          // 0x62 => b
        } else if (core.isCharCode(0x62, zeroOffset, s.src)) {
          // BINARY
          return finalizeInt(
            args.invalid,
            args.binary,
            baseOffset,
            await core.consumeBase(2, baseOffset, s.src),
            s
          );
        } else {
          // Float
          return finalizeFloat(
            core,
            args.invalid,
            args.expecting,
            args.int,
            args.float,
            [zeroOffset, 0],
            s as any
          );
        }
      }
      // Float
      return finalizeFloat(
        core,
        args.invalid,
        args.expecting,
        args.int,
        args.float,
        await core.consumeBase(10, s.offset, s.src),
        s as any
      );
    });
  };

function finalizeInt<SRC, A, PROBLEM>(
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

function bumpOffset<SRC, CTX>(
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
async function finalizeFloat<
  CORE extends SRCTypes.HasStringCore<any> & SRCTypes.HasCore<any, any, any>,
  A,
  PROBLEM
>(
  core: CORE,
  invalid: PROBLEM,
  expecting: PROBLEM,
  intSettings: Results.Result<(n: number) => A, PROBLEM>,
  floatSettings: Results.Result<(n: number) => A, PROBLEM>,
  floatPair: [number, number],
  s: State<SRCTypes.GetHasStringCoreSRC<CORE>, unknown>
): Promise<PStep<SRCTypes.GetHasStringCoreSRC<CORE>, A, never, PROBLEM>> {
  const intOffset = floatPair[0];
  const floatOffset = consumeDotAndExp(core, intOffset, s.src);

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
        const n = parseFloat(await core.slice(s.offset, floatOffset, s.src));
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
function consumeDotAndExp<CORE extends SRCTypes.HasStringCore<any>>(
  core: CORE,
  offset: number,
  src: SRCTypes.GetHasStringCoreSRC<CORE>
): number {
  // 0x2e => '.'
  if (core.isCharCode(0x2e, offset, src)) {
    return consumeExp(core, core.chompBase10(offset + 1, src), src);
  } else {
    return consumeExp(core, offset, src);
  }
}

/**
 * On a failure, returns a negative index of the problem.
 *
 */
function consumeExp<CORE extends SRCTypes.HasStringCore<any>>(
  core: CORE,
  offset: number,
  src: SRCTypes.GetHasStringCoreSRC<CORE>
): number {
  // 0x65 => 'e'
  // 0x45 => 'E'
  if (
    core.isCharCode(0x65, offset, src) ||
    core.isCharCode(0x45, offset, src)
  ) {
    const eOffset = offset + 1;
    // 0x2b => '+'
    // 0x2d => '-'
    const expOffset =
      core.isCharCode(0x2b, offset, src) || core.isCharCode(0x2d, offset, src)
        ? eOffset + 1
        : eOffset;

    const newOffset = core.chompBase10(expOffset, src);
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
export const end =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <PROBLEM>(problem: PROBLEM): Parser<CORE, Unit, never, PROBLEM> => {
    return new ParserImpl(core, async (s) => {
      if (core.isEnd(s.offset, s.src)) {
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
 * - {@link mapChompedChunk}
 *
 * @category Chompers
 */
export const getChompedChunk =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    parser: Parser<CORE, A, CTX, PROBLEM>
  ): Parser<CORE, SRCTypes.GetHasCoreCHUNK<CORE>, CTX, PROBLEM> => {
    return mapChompedChunk(core)((a: any) => a)(parser);
  };

/**
 * Just like {@link Simple!mapChompedString | Simple.mapChompedString}
 *
 * @see
 * - {@link getChompedChunk}
 *
 * @category Chompers
 */
export const mapChompedChunk =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <CHOMPED, A, B>(fn: (s: CHOMPED, v: A) => B) =>
  <CTX, PROBLEM>(
    parser: Parser<CORE, A, CTX, PROBLEM>
  ): Parser<CORE, B, CTX, PROBLEM> => {
    return new ParserImpl(core, async (s) => {
      const res = await parser.exec(s);
      if (isBad(res)) {
        return res;
      } else {
        return Good(
          res.haveConsumed,
          fn(await core.slice(s.offset, res.state.offset, s.src), res.value),
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
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  (isGood: (token: SRCTypes.GetHasCoreTOKEN<CORE>) => boolean) =>
  <PROBLEM>(expecting: PROBLEM): Parser<CORE, Unit, never, PROBLEM> => {
    return new ParserImpl(core, async (s) => {
      const newOffset = await core.isSubToken(isGood, s.offset, s.src);
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

type ChompWhile<CORE extends SRCTypes.HasCore<any, any, any>, TOKEN> = {
  <A>(isGood: (token: TOKEN, state: A) => [boolean, A], init: A): Parser<
    CORE,
    Unit,
    never,
    never
  >;
  (isGood: (token: TOKEN) => boolean): Parser<CORE, Unit, never, never>;
};

/**
 * Just like {@link Simple!chompWhile | Simple.chompWhile}
 *
 * @category Chompers
 */
export const chompWhile =
  <CORE extends SRCTypes.HasCore<any, any, any>>(
    core: CORE
  ): ChompWhile<CORE, SRCTypes.GetHasCoreTOKEN<CORE>> =>
  (isGood: any, init?: any): Parser<CORE, Unit, never, never> => {
    return new ParserImpl(core, (s) =>
      chompWhileHelp(core, isGood, init, s.offset, s.row, s.col, s)
    );
  };

type ChompWhile1<CORE extends SRCTypes.HasCore<any, any, any>, TOKEN> = {
  <PROBLEM, A>(
    problem: PROBLEM,
    isGood: (char: string, state: A) => [boolean, A],
    init: A
  ): Parser<CORE, Unit, never, PROBLEM>;
  <PROBLEM>(problem: PROBLEM, isGood: (char: string) => boolean): Parser<
    CORE,
    Unit,
    never,
    PROBLEM
  >;
};

/**
 * Just like {@link Simple!chompWhile1 | Simple.chompWhile1}
 *
 * @category Chompers
 */
export const chompWhile1 =
  <CORE extends SRCTypes.HasCore<any, any, any>>(
    core: CORE
  ): ChompWhile1<CORE, SRCTypes.GetHasCoreTOKEN<CORE>> =>
  <PROBLEM>(
    problem: PROBLEM,
    isGood: any,
    init?: any
  ): Parser<CORE, Unit, never, PROBLEM> => {
    return new ParserImpl(core, (s) =>
      chompWhileHelp(core, isGood, init, s.offset, s.row, s.col, s, {
        chompMinOneProblem: problem,
      })
    );
  };

async function chompWhileHelp<
  CORE extends SRCTypes.HasCore<any, any, any>,
  A,
  PROBLEM
>(
  core: CORE,
  isGood:
    | ((token: SRCTypes.GetHasCoreTOKEN<CORE>) => boolean)
    | ((token: SRCTypes.GetHasCoreTOKEN<CORE>, state: A) => [boolean, A]),
  init: any,
  offset: number,
  row: number,
  col: number,
  s0: State<SRCTypes.GetHasCoreSRC<CORE>, unknown>,
  config?: {
    chompMinOneProblem: PROBLEM;
  }
): Promise<PStep<SRCTypes.GetHasCoreSRC<CORE>, Unit, never, PROBLEM>> {
  let finalOffset = offset;
  let finalRow = row;
  let finalCol = col;

  let state = init;

  const fn =
    isGood.length === 1
      ? (isGood as (token: SRCTypes.GetHasCoreTOKEN<CORE>) => boolean)
      : (token: SRCTypes.GetHasCoreTOKEN<CORE>) => {
          // @ts-ignore
          const [returnVal, newState] = isGood(char, state);
          state = newState;
          return returnVal;
        };

  let iterations = 0;

  let newOffset = await core.isSubToken(fn, offset, s0.src);
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

    newOffset = await core.isSubToken(fn, finalOffset, s0.src);
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
export const chompUntil =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <PROBLEM>(
    token: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBLEM>
  ): Parser<CORE, Unit, never, PROBLEM> => {
    return new ParserImpl(core, async (s) => {
      const [didMatch, newOffset, newRow, newCol] = await core.findSubChunk(
        token.value,
        s.offset,
        s.row,
        s.col,
        s.src
      );
      if (!didMatch) {
        return Bad(false, fromInfo(newRow, newCol, token.problem, s.context));
      } else {
        const [finalOffset, finalRow, finalCol] = await core.isSubChunk(
          token.value,
          newOffset,
          newRow,
          newCol,
          s.src
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
export const chompUntilEndOr =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  (chunk: SRCTypes.GetHasCoreCHUNK<CORE>): Parser<CORE, Unit, never, never> => {
    return new ParserImpl(core, async (s) => {
      const [didMatch, newOffset, newRow, newCol] = await core.findSubChunk(
        chunk,
        s.offset,
        s.row,
        s.col,
        s.src
      );
      const [finalOffset, finalRow, finalCol] = await core.isSubChunk(
        chunk,
        newOffset,
        newRow,
        newCol,
        s.src
      );
      const adjustedOffset = finalOffset < 0 ? newOffset : finalOffset;
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
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <CTX>(ctx: CTX) =>
  <A, PROBLEM>(
    parser: Parser<CORE, A, CTX, PROBLEM>
  ): Parser<CORE, A, CTX, PROBLEM> => {
    return new ParserImpl(core, async (s0) => {
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

function changeContext<SRC, CTX>(
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
export const getIndent = <CORE extends SRCTypes.HasCore<any, any, any>>(
  core: CORE
) =>
  new ParserImpl<CORE, number, never, never>(
    core,
    async (
      s: State<SRCTypes.GetHasCoreSRC<CORE>, never>
    ): Promise<PStep<SRCTypes.GetHasCoreSRC<CORE>, number, never, never>> =>
      Good(false, s.indent, s)
  );

/**
 * Just like {@link Simple!withIndent | Simple.withIndent}
 *
 * @category Indentation
 */
export const withIndent =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  (newIndent: number) => {
    if (newIndent < 0) {
      throw Error(`Indentation was smaller then 1, value: ${newIndent}`);
    }
    return <A, CTX, PROBLEM>(
      parse: Parser<CORE, A, CTX, PROBLEM>
    ): Parser<CORE, A, CTX, PROBLEM> => {
      return new ParserImpl(core, async (s) => {
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

function changeIndent<SRC, CTX>(
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
export const optional =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    parser: Parser<CORE, A, CTX, PROBLEM>
  ): Parser<CORE, A | undefined, CTX, PROBLEM> => {
    return parser.or(succeed(core)(undefined));
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
export const keyword =
  <CORE extends SRCTypes.HasCore<any, any, string>>(core: CORE) =>
  <PROBLEM>(
    token: Token<string, PROBLEM>
  ): Parser<CORE, Unit, never, PROBLEM> => {
    const kwd = token.value;

    const progress = kwd.length > 0;

    return new ParserImpl(core, async (s) => {
      const [newOffset, newRow, newCol] = await core.isSubChunk(
        kwd,
        s.offset,
        s.row,
        s.col,
        s.src
      );

      if (
        newOffset === -1 ||
        0 <=
          (await core.isSubToken(
            (c) => Helpers.isAlphaNum(c) || c === "_",
            newOffset,
            s.src
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
export const getPosition = <CORE extends SRCTypes.HasCore<any, any, any>>(
  core: CORE
): Parser<CORE, [number, number], never, never> =>
  new ParserImpl(
    core,
    async (
      s: State<SRCTypes.GetHasCoreSRC<CORE>, unknown>
    ): Promise<
      PStep<SRCTypes.GetHasCoreSRC<CORE>, [number, number], never, never>
    > => Good(false, [s.row, s.col], s)
  );

/**
 * Just like {@link Simple!getRow | Simple.getRow}
 *
 * @category Positions
 */
export const getRow = <CORE extends SRCTypes.HasCore<any, any, any>>(
  core: CORE
): Parser<CORE, number, never, never> =>
  new ParserImpl(
    core,
    async (
      s: State<SRCTypes.GetHasCoreSRC<CORE>, unknown>
    ): Promise<PStep<SRCTypes.GetHasCoreSRC<CORE>, number, never, never>> =>
      Good(false, s.row, s)
  );

/**
 * Just like {@link Simple!getCol | Simple.getCol}
 *
 * @category Positions
 */
export const getCol = <CORE extends SRCTypes.HasCore<any, any, any>>(
  core: CORE
): Parser<CORE, number, never, never> =>
  new ParserImpl(
    core,
    async (
      s: State<SRCTypes.GetHasCoreSRC<CORE>, unknown>
    ): Promise<PStep<SRCTypes.GetHasCoreSRC<CORE>, number, never, never>> =>
      Good(false, s.col, s)
  );

/**
 * Just like {@link Simple!getOffset | Simple.getOffset}
 *
 * @category Positions
 */
export const getOffset = <CORE extends SRCTypes.HasCore<any, any, any>>(
  core: CORE
): Parser<CORE, number, never, never> =>
  new ParserImpl(
    core,
    async (
      s: State<SRCTypes.GetHasCoreSRC<CORE>, unknown>
    ): Promise<PStep<SRCTypes.GetHasCoreSRC<CORE>, number, never, never>> =>
      Good(false, s.offset, s)
  );

/**
 * TODO: This is not implemented yet.
 *
 * Just like {@link Simple!getSource | Simple.getSource}
 *
 * @category Positions
 */
export const getSource = <CORE extends SRCTypes.HasCore<any, any, any>>(
  core: CORE
): Parser<CORE, SRCTypes.GetHasCoreSRC<CORE>, never, never> =>
  new ParserImpl(
    core,
    async (
      s: State<SRCTypes.GetHasCoreSRC<CORE>, unknown>
    ): Promise<
      PStep<
        SRCTypes.GetHasCoreSRC<CORE>,
        SRCTypes.GetHasCoreSRC<CORE>,
        never,
        never
      >
    > => Good(false, s.src, s)
  );

// VARIABLES

/**
 * Just like {@link Simple!variable | Simple.variable} except you specify the
 * problem yourself.
 *
 * @category Building Blocks
 */
export const variable =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <PROBLEM>(args: {
    start: (token: SRCTypes.GetHasCoreTOKEN<CORE>) => boolean;
    inner: (token: SRCTypes.GetHasCoreTOKEN<CORE>) => boolean;
    reserved: Set<SRCTypes.GetHasCoreCHUNK<CORE>>;
    expecting: PROBLEM;
  }): Parser<CORE, SRCTypes.GetHasCoreCHUNK<CORE>, never, PROBLEM> => {
    return new ParserImpl(core, async (s) => {
      const firstOffset = await core.isSubToken(
        args.start as any,
        s.offset,
        s.src
      );

      if (firstOffset === -1) {
        return Bad(false, fromState(s, args.expecting));
      }

      const s1 =
        firstOffset === -2
          ? await varHelp(core)(
              args.inner,
              s.offset + 1,
              s.row + 1,
              1,
              s.src,
              s.indent,
              s.context
            )
          : await varHelp(core)(
              args.inner,
              firstOffset,
              s.row,
              s.col + 1,
              s.src,
              s.indent,
              s.context
            );
      const name = await core.slice(s.offset, s1.offset, s.src);
      if (args.reserved.has(name)) {
        return Bad(false, fromState(s, args.expecting));
      } else {
        return Good(true, name, s1);
      }
    });
  };

const varHelp =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  async <CTX>(
    isGood: (s: SRCTypes.GetHasCoreTOKEN<CORE>) => boolean,
    offset: number,
    row: number,
    col: number,
    src: SRCTypes.GetHasCoreSRC<CORE>,
    indent: number,
    context: immutable.Stack<Located<CTX>>
  ): Promise<State<SRCTypes.GetHasCoreSRC<CORE>, CTX>> => {
    let currentOffset = offset;
    let currentRow = row;
    let currentCol = col;

    while (true) {
      const newOffset = await core.isSubToken(isGood, currentOffset, src);
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
export const sequence =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX1, CTX2, PROBLEM1, PROBLEM2, PROBLEM3, PROBLEM4, PROBLEM5>(args: {
    start: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBLEM1>;
    separator: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBLEM2>;
    end: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBLEM3>;
    spaces: Parser<CORE, Unit, CTX1, PROBLEM4>;
    item: Parser<CORE, A, CTX2, PROBLEM5>;
    trailing: Trailing;
  }): Parser<
    CORE,
    immutable.List<A>,
    CTX1 | CTX2,
    PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4 | PROBLEM5
  > => {
    return succeed(core)(Unit)
      .skip(token(core)(args.start))
      .skip(args.spaces)
      .keep(
        sequenceEnd(core)<
          A,
          CTX1 | CTX2,
          PROBLEM1 | PROBLEM2 | PROBLEM3 | PROBLEM4 | PROBLEM5
        >(
          token(core)(args.end),
          args.spaces,
          args.item,
          token(core)(args.separator),
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

const sequenceEnd =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    ender: Parser<CORE, Unit, CTX, PROBLEM>,
    ws: Parser<CORE, Unit, CTX, PROBLEM>,
    parseItem: Parser<CORE, A, CTX, PROBLEM>,
    sep: Parser<CORE, Unit, CTX, PROBLEM>,
    trailing: Trailing
  ): Parser<CORE, immutable.List<A>, CTX, PROBLEM> => {
    const chompRest = (item: A) => {
      const init = immutable.List([item]);
      if (trailing === Trailing.Forbidden) {
        return loop(core)(init)(
          sequenceEndForbidden(core)(ender, ws, parseItem, sep)
        );
      } else if (trailing === Trailing.Optional) {
        return loop(core)(init)(
          sequenceEndOptional(core)(ender, ws, parseItem, sep)
        );
      } else {
        return succeed(core)(Unit)
          .skip(ws)
          .skip(sep)
          .skip(ws)
          .keep(
            loop(core)(init)(sequenceEndMandatory(core)(ws, parseItem, sep))
          )
          .skip(ender);
      }
    };
    return oneOf(core)(
      parseItem.andThen(chompRest),
      ender.map(() => immutable.List())
    );
  };

const sequenceEndForbidden =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    ender: Parser<CORE, Unit, CTX, PROBLEM>,
    ws: Parser<CORE, Unit, CTX, PROBLEM>,
    parseItem: Parser<CORE, A, CTX, PROBLEM>,
    sep: Parser<CORE, Unit, CTX, PROBLEM>
  ) =>
  (
    state: immutable.List<A>
  ): Parser<CORE, Step<immutable.List<A>, immutable.List<A>>, CTX, PROBLEM> => {
    return succeed(core)(Unit)
      .skip(ws)
      .keep(
        oneOf(core)(
          succeed(core)((item: A) => Loop(state.push(item)))
            .skip(sep)
            .skip(ws)
            .apply(parseItem),
          succeed(core)(Done(state)).skip(ender)
        )
      );
  };

const sequenceEndOptional =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    ender: Parser<CORE, Unit, CTX, PROBLEM>,
    ws: Parser<CORE, Unit, CTX, PROBLEM>,
    parseItem: Parser<CORE, A, CTX, PROBLEM>,
    sep: Parser<CORE, Unit, CTX, PROBLEM>
  ) =>
  (
    state: immutable.List<A>
  ): Parser<CORE, Step<immutable.List<A>, immutable.List<A>>, CTX, PROBLEM> => {
    return succeed(core)(Unit)
      .skip(ws)
      .keep(
        oneOf(core)(
          succeed(core)(Unit)
            .skip(sep)
            .skip(ws)
            .keep(
              oneOf(core)(
                succeed(core)((item: A) => Loop(state.push(item))).apply(
                  parseItem
                ),
                succeed(core)(Done(state)).skip(ender)
              )
            ),
          succeed(core)(Done(state)).skip(ender)
        )
      );
  };

const sequenceEndMandatory =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    ws: Parser<CORE, Unit, CTX, PROBLEM>,
    parseItem: Parser<CORE, A, CTX, PROBLEM>,
    sep: Parser<CORE, Unit, CTX, PROBLEM>
  ) =>
  (
    state: immutable.List<A>
  ): Parser<CORE, Step<immutable.List<A>, immutable.List<A>>, CTX, PROBLEM> => {
    return oneOf(core)(
      succeed(core)((item: A) => Loop(state.push(item)))
        .apply(parseItem)
        .skip(ws)
        .skip(sep)
        .skip(ws),
      succeed(core)(Done(state))
    );
  };

// MANY

/**
 * Just like {@link Simple!many | Simple.many}
 *
 * @category Loops
 */
export const many =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    parseItem: Parser<CORE, A, CTX, PROBLEM>
  ): Parser<CORE, A[], CTX, PROBLEM> => {
    return loop(core)<immutable.List<A>>(immutable.List())(
      manyHelp(core)(parseItem)
    ).map((xs) => xs.toArray());
  };

const manyHelp =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(parseItem: Parser<CORE, A, CTX, PROBLEM>) =>
  (
    state: immutable.List<A>
  ): Parser<CORE, Step<immutable.List<A>, immutable.List<A>>, CTX, PROBLEM> => {
    return oneOf(core)(
      parseItem.map((item) => Loop(state.push(item))),
      succeed(core)(Unit).map(() => Done(state))
    );
  };

// MANY1

/**
 * Just like {@link Simple!many1 | Simple.many1} but you
 * provide the problem yourself.
 *
 * @category Loops
 */
export const many1 =
  <CORE extends SRCTypes.HasCore<any, any, any>>(core: CORE) =>
  <A, CTX, PROBLEM>(
    parseItem: Parser<CORE, A, CTX, PROBLEM>,
    p: PROBLEM
  ): Parser<CORE, A[], CTX, PROBLEM> => {
    return many(core)(parseItem).andThen((items) =>
      items.length === 0 ? problem(core)(p) : succeed(core)(items)
    );
  };

// WHITESPACE

/**
 * Just like {@link Simple!spaces | Simple.spaces}
 *
 * @category Whitespace
 */
export const spaces = <CORE extends SRCTypes.HasCore<any, any, string>>(
  core: CORE
): Parser<CORE, Unit, never, never> =>
  new ParserImpl<CORE, Unit, never, never>(
    core,
    (s: State<SRCTypes.GetHasCoreSRC<CORE>, unknown>) =>
      chompWhile(core)((c) => c === " " || c === "\n" || c === "\r").exec(s)
  );

// LINE COMMENT

/**
 * Just like {@link Simple!lineComment | Simple.lineComment} except you provide a
 * `Token` describing the starting symbol.
 *
 * @category Whitespace
 */
export const lineComment =
  <CORE extends SRCTypes.HasCore<any, string, any>>(core: CORE) =>
  <PROBLEM>(
    start: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBLEM>
  ): Parser<CORE, Unit, never, PROBLEM> =>
    skip2nd(core)<Unit, never, PROBLEM>(token(core)(start))(
      chompUntilEndOr(core)("\n" as any)
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
  <CORE extends SRCTypes.HasCore<any, string, any>>(core: CORE) =>
  <PROBLEM>(open: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBLEM>) =>
  (close: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBLEM>) =>
  (nestable: Nestable): Parser<CORE, Unit, never, PROBLEM> => {
    if (isNotNestable(nestable)) {
      return skip2nd(core)(token(core)(open))(chompUntil(core)(close));
    } else {
      return nestableComment<CORE, PROBLEM>(core, open, close);
    }
  };

function nestableComment<
  CORE extends SRCTypes.HasCore<any, string, any>,
  PROBELM
>(
  core: CORE,
  open: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBELM>,
  close: Token<SRCTypes.GetHasCoreCHUNK<CORE>, PROBELM>
): Parser<CORE, Unit, never, PROBELM> {
  const openChar = open.value.at(0);
  const closeChar = close.value.at(0);
  if (openChar === undefined) {
    return problem(core)(open.problem);
  }
  if (closeChar === undefined) {
    return problem(core)(close.problem);
  }

  const isNotRelevant = (char: SRCTypes.GetHasCoreTOKEN<CORE>) =>
    char != openChar && char != closeChar;

  const chompOpen = token(core)(open);

  return skip2nd(core)(chompOpen)(
    nestableHelp(
      core,
      isNotRelevant,
      token(core)(open),
      token(core)(close),
      close.problem,
      1
    )
  );
}

function nestableHelp<
  CORE extends SRCTypes.HasCore<any, string, any>,
  CTX,
  PROBLEM
>(
  core: CORE,
  isNotRelevant: (c: SRCTypes.GetHasCoreTOKEN<CORE>) => boolean,
  open: Parser<CORE, Unit, CTX, PROBLEM>,
  close: Parser<CORE, Unit, CTX, PROBLEM>,
  expectingClose: PROBLEM,
  nestLevel: number
): Parser<CORE, Unit, CTX, PROBLEM> {
  const first =
    nestLevel === 1
      ? close
      : close.andThen(() =>
          nestableHelp(
            core,
            isNotRelevant,
            open,
            close,
            expectingClose,
            nestLevel - 1
          )
        );
  const second = open.andThen(() =>
    nestableHelp(
      core,
      isNotRelevant,
      open,
      close,
      expectingClose,
      nestLevel + 1
    )
  );
  const third = chompIf(core)(() => true)(expectingClose).andThen(() =>
    nestableHelp(core, isNotRelevant, open, close, expectingClose, nestLevel)
  );

  return skip1st(core)(chompWhile(core)(isNotRelevant))(
    oneOf(core)(first, second, third)
  );
}
