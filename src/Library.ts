import * as P from "./Parser.js";

type ParserCore<STREAM extends Stream<any, any>> = {};

/**
 * A full parser library for a given Stream type.
 */
export type ParserLibrary<STREAM extends Stream<any, any>> = {
  succeed<A>(a: A): P.Parser<A, never, never>;
  problem<PROBLEM>(p: PROBLEM): P.Parser<never, never, PROBLEM>;
  map: <A, B>(
    fn: (a: A) => B
  ) => <CTX, PROBLEM>(
    parser: P.Parser<A, CTX, PROBLEM>
  ) => P.Parser<B, CTX, PROBLEM>;

  map2: <A, B, C>(
    fn: (a: A, b: B) => C
  ) => <CTX, PROBLEM>(
    parserA: P.Parser<A, CTX, PROBLEM>
  ) => <CTX2, PROBLEM2>(
    parserB: P.Parser<B, CTX2, PROBLEM2>
  ) => P.Parser<C, CTX | CTX2, PROBLEM | PROBLEM2>;

  apply: <A, B, CTX, PROBLEM>(
    parseFunc: P.Parser<(a: A) => B, CTX, PROBLEM>
  ) => <CTX2, PROBLEM2>(
    parseArg: P.Parser<A, CTX2, PROBLEM2>
  ) => P.Parser<B, CTX | CTX2, PROBLEM | PROBLEM2>;

  skip1st: <CTX, PROBLEM>(
    first: P.Parser<unknown, CTX, PROBLEM>
  ) => <A, CTX2, PROBLEM2>(
    second: P.Parser<A, CTX2, PROBLEM2>
  ) => P.Parser<A, CTX | CTX2, PROBLEM | PROBLEM2>;

  skip2nd: <A, CTX, PROBLEM>(
    keepParser: P.Parser<A, CTX, PROBLEM>
  ) => <CTX2, PROBLEM2>(
    ignoreParser: P.Parser<unknown, CTX2, PROBLEM2>
  ) => P.Parser<A, CTX | CTX2, PROBLEM | PROBLEM2>;

  andThen: <A, B, CTX, PROBLEM>(
    fn: (a: A) => P.Parser<B, CTX, PROBLEM>
  ) => <CTX2, PROBLEM2>(
    p: P.Parser<A, CTX2, PROBLEM2>
  ) => P.Parser<B, CTX | CTX2, PROBLEM | PROBLEM2>;

  lazy: <A, CTX, PROBLEM>(
    thunk: () => P.Parser<A, CTX, PROBLEM>
  ) => P.Parser<A, CTX, PROBLEM>;

  // TODO add more primitives
  // Though we might hust get the
};

type Stream<CHUNK, TOKEN> = {};

/**
 *
 * @param core - the core definitions to turn a stream into a parser library
 * @returns a parser library
 */
export const init = <STREAM extends Stream<any, any>>(
  core: ParserCore<STREAM>
): ParserLibrary<STREAM> => {
  throw new Error("Not implemented");
};
