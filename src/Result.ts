/**
 * The result of a computation can either be `Ok` or `Err`
 *
 * @remark
 * If you are familiar with functional programming you will recognize this as you
 * standard `Either` type. I've kept the implementation very basic. If you want
 * a richer type with a bnuch of utility functions you can easily wrap the
 * {@link Simple.run} function yourself.
 *
 * ```ts
 * import * as Results from "ts-results";
 * import * as P from "@honungsburk/kombo/Simple";
 *
 * const run =
 *   <A>(parser: Parser<A>) =>
 *   (src: string): Results.Result<A, DeadEnd[]> => {
 *      const res = P.run(parser)(src);
 *      if(P.isErr(res)){
 *        return new Results.Err(res.value)
 *      } else {
 *        return new Results.Ok(res.value)
 *      }
 *   };
 * ```
 *
 *
 * @see
 * - {@link https://gcanti.github.io/fp-ts/ fp-ts}
 * - {@link https://github.com/vultix/ts-results ts-result}
 *
 * @category Result
 */
export type Result<A, E> = Ok<A> | Err<E>;

/**
 * Represents a successful computation
 *
 * @category Result
 */
export type Ok<A> = {
  readonly kind: "Ok";
  readonly value: A;
  readonly isOk: true;
  readonly isErr: false;
};

/**
 * Construct an `Ok`,
 */
export function Ok<A>(value: A): Ok<A> {
  return {
    kind: "Ok",
    value,
    isOk: true,
    isErr: false,
  };
}

/**
 * Type guard for {@link Ok}
 *
 * @category Result
 */
export function isOk<A>(x: Result<A, unknown>): x is Ok<A> {
  return x.kind === "Ok";
}

/**
 * When something goes wrong we don't throw an error, instead, we return an `Err`.
 *
 * @category Result
 */
export type Err<E> = {
  readonly kind: "Err";
  readonly value: E;
  readonly isOk: false;
  readonly isErr: true;
};

/**
 * Construct an `Err`,
 */
export function Err<E>(value: E): Err<E> {
  return {
    kind: "Err",
    value,
    isOk: false,
    isErr: true,
  };
}

/**
 * Type guard for {@link Err}
 *
 * @category Result
 */
export function isErr<E>(x: Result<unknown, E>): x is Err<E> {
  return x.kind === "Err";
}
