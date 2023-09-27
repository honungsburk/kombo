/**
 * Map over an AsyncGenerator
 *
 * @param gen
 * @param onYield
 * @param onReturn
 * @returns
 */
export async function* map<
  T = unknown,
  B = unknown,
  TReturn = any,
  BReturn = any,
  TNext = unknown
>(
  gen: AsyncGenerator<T, TReturn, TNext>,
  onYield: (x: T) => B,
  onReturn: (x: TReturn) => BReturn
): AsyncGenerator<B, BReturn, TNext> {
  let value = await gen.next();
  while (!value.done) {
    yield onYield(value.value);
    value = await gen.next();
  }
  return onReturn(value.value);
}
