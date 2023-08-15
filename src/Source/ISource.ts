/**
 * An abstract interface that the parser uses to access the source input. This
 * allows us to implement a source that is backed by a string, array, or a
 * node stream.
 *
 * TOKEN is a single token that can be extracted from the source.
 * CHUNK is a collection of tokens that can be extracted from the source.
 *
 * Examples:
 * ```ts
 * class StringSource implements ISource<string, string> {
 *  ...
 * }
 *
 * class ArraySource<A> implements ISource<A, A[]> {
 *  ...
 * }
 * ```
 */
export default interface ISource<TOKEN, CHUNK> {
  /**
   *
   * The reason we return the new offset instead of a boolean is that some
   * sources (such as a strings) singel tokens can have different lengths.
   * The character 'a' has length 1, but the character '🙊' has length 2.
   *
   * Return values:
   * - `-1` means that the predicate failed
   * - `-2` means the predicate succeeded with a but we are on new line/row
   * - `>= 0` means the predicate succeeded and we are on the same line/row
   *
   * Note: A lot of implementations will probably just return -1 or or the new offset.
   * If you are implementing a source that has a concept of rows and columns, you
   * can return -2 to indicate that the predicate succeeded, but we are on a new
   * line/row.
   *
   * @param predicate - the predicate to use to test the token
   * @param offset -  the offset of the token to look at
   * @returns the new offset if the predicate returns true (or -2), otherwise -1 if it was false
   */
  isSubToken(
    predicate: (token: TOKEN) => boolean,
    offset: number
  ): Promise<number> | number;

  /**
   * Just like `isSubToken`, but for chunks.
   *
   * We support both row and col because some sources (such as strings) have
   * a concept of rows and columns. Some don't like arrays, but then we can
   * just ignore them.
   *
   * Note that row and col both start at 1.
   *
   * @param subChunk - the subchunk to check for at the offset
   * @param offset - the offset
   * @param row - the current row
   * @param col - the current column
   * @returns the new offset if the predicate returns true, otherwise -1, row, col
   */
  isSubChunk: (
    subChunk: CHUNK,
    offset: number,
    row: number,
    col: number
  ) => Promise<[number, number, number]> | [number, number, number];

  /**
   * Searches for a subchunk in the source from a given offset.
   *
   * We support both row and col because some sources (such as strings) have
   * a concept of rows and columns. Some don't like arrays, but then we can
   * just ignore them.
   *
   * Note that row and col both start at 1.
   *
   * @param subChunk - the subchunk to search for
   * @param offset - the offset to start searching from
   * @param row - the current row
   * @param col - the current column
   * @returns if it found the chunk, offset, row, col. If it didn't find it offset, row, and col will be at the end of the source.
   */
  findSubChunk(
    subChunk: CHUNK,
    offset: number,
    row: number,
    col: number
  ):
    | Promise<[boolean, number, number, number]>
    | [boolean, number, number, number];

  /**
   * Checks if the source is at the end.
   *
   * @param offset - the offset to check
   * @returns true if the source is at the end, otherwise false
   *
   * @category Uses offset
   */
  isEnd(offset: number): Promise<boolean> | boolean;

  slice(startOffset: number, endOffset: number): Promise<CHUNK> | CHUNK;
}

/**
 * A helper type that extracts the CHUNK type from a source.
 */
export type GetChunk<SRC extends ISource<any, any>> = SRC extends ISource<
  any,
  infer CHUNK
>
  ? CHUNK
  : never;

/**
 * A helper type that extracts the TOKEN type from a source.
 */
export type GetToken<SRC extends ISource<any, any>> = SRC extends ISource<
  infer TOKEN,
  any
>
  ? TOKEN
  : never;
