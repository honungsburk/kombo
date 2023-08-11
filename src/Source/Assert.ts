/**
 * Assert that the given value is a string, otherwise throw an error.
 *
 * @param x - the value to check
 */
export function isString(x: any): asserts x is string {
  if (typeof x !== "string") {
    throw new Error("Expected string");
  }
}

/**
 * Assert that the given value is a buffer, otherwise throw an error.
 *
 * @param x - the value to check
 */
export function isBuffer(x: any): asserts x is Buffer {
  if (!(x instanceof Buffer)) {
    throw new Error("Expected a buffer");
  }
}
