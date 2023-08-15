import ISource from "./ISource.js";

/**
 * TODO: Split this type into single method interfaces. Better for composition.
 *
 * A source that is backed by a string.
 *
 * Contains some extra methods that are specific to strings.
 *
 * @category Source
 */
export default interface IStringSource extends ISource<string, string> {
  /**
   *
   * Check if the character at the given offset has the given charcode.
   *
   * @example
   * ```ts
   *    new StringSource("aaa")
   *        .isCharCode(1,  97)
   *    // => true
   *
   *    new StringSource("aaaaaaaaaaäaaaa")
   *        .isCharCode(10, 97)
   *    // => false
   * ```
   *
   * @param code - the character code to check against
   * @param offset - the offset into the string
   * @returns true if the character at the given offset has the given code, otherwise false
   *
   * @category Uses offset
   */
  isCharCode(code: number, offset: number): Promise<boolean> | boolean;

  /**
   * Consume all characters in base 16.
   *
   * @example
   * ```ts
   * new StringSource("ABCDEF0123456789")
   *          .consumeBase16(0)
   *    // => [16, 12379813738877118000]
   * new StringSource("åäöABCDEF!StopABCDEF")
   *          .consumeBase16(3)
   *    // => [9, 11259375]
   * ```
   *
   * @param offset - where in the string to start consuming
   * @returns a new offset and the consumed number converted to base 10
   *
   * @category Numbers
   */
  consumeBase16(offset: number): Promise<[number, number]> | [number, number];

  /**
   * Consume all characters in a given base.
   *
   * @example
   * ```ts
   * new StringSource("0123456789")
   *  .consumeBase(8, 0)
   *    // => [8, 342391]
   * new StringSource("999")
   *  .consumeBase(8, 1)
   *    // => [1, 0]
   * ```
   *
   * @param base    - the base to use i.e. one of 2, 3, 4, 5 ,...
   * @param offset  - where in the string to start consuming
   * @returns the new offset and the number it consumed converted to base 10
   *
   * @category Numbers
   */
  consumeBase(
    base: number,
    offset: number
  ): Promise<[number, number]> | [number, number];

  /**
   *
   * Skips number characters, a.k.a. any one of 1,2,3,4,5,6,7,8,9
   *
   * @example
   * ```ts
   * new StringSource("aaaaaaaaaa1928a").chompBase10(2)  // => 2
   * new StringSource("aaaaaaaaaa1928a").chompBase10(10) // => 14
   * ```
   *
   * @param offset - the offset to start looking from
   * @returns the new offset after "removing" all base 10 numbers
   *
   * @category Numbers
   */
  chompBase10(offset: number): number;
}
