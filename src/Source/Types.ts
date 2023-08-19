////////////////////////////////////////////////////////////////////////////////
// Core Mixins
////////////////////////////////////////////////////////////////////////////////

export type HasCore<SRC, CHUNK, TOKEN> = HasIsEnd<SRC> &
  HasSlice<SRC, CHUNK> &
  HasIsSubChunk<SRC, CHUNK> &
  HasFindSubChunk<SRC, CHUNK> &
  HasIsSubToken<SRC, TOKEN>;

export type GetHasCoreSRC<CORE extends HasCore<any, any, any>> =
  CORE extends HasCore<infer SRC, any, any> ? SRC : never;
export type GetHasCoreCHUNK<CORE extends HasCore<any, any, any>> =
  CORE extends HasCore<any, infer CHUNK, any> ? CHUNK : never;
export type GetHasCoreTOKEN<CORE extends HasCore<any, any, any>> =
  CORE extends HasCore<any, any, infer TOKEN> ? TOKEN : never;

export type HasIsSubToken<SRC, TOKEN> = {
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
    offset: number,
    src: SRC
  ): Promise<number> | number;
};

export type HasIsSubChunk<SRC, CHUNK> = {
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
    col: number,
    src: SRC
  ) => Promise<[number, number, number]> | [number, number, number];
};

export type HasFindSubChunk<SRC, CHUNK> = {
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
    col: number,
    src: SRC
  ):
    | Promise<[boolean, number, number, number]>
    | [boolean, number, number, number];
};

export type HasIsEnd<SRC> = {
  /**
   * Checks if the source is at the end.
   *
   * @param offset - the offset to check
   * @returns true if the source is at the end, otherwise false
   *
   * @category Uses offset
   */
  isEnd(offset: number, src: SRC): Promise<boolean> | boolean;
};

export type HasSlice<SRC, CHUNK> = {
  /**
   *
   * @param startOffset - the offset to start slicing from
   * @param endOffset - the offset to end slicing at
   * @param src - the source to slice
   */
  slice(
    startOffset: number,
    endOffset: number,
    src: SRC
  ): Promise<CHUNK> | CHUNK;
};

////////////////////////////////////////////////////////////////////////////////
// String Mixins
////////////////////////////////////////////////////////////////////////////////

export type HasStringCore<SRC> = HasIsCharCode<SRC> &
  HasConsumeBase16<SRC> &
  HasConsumeBase<SRC> &
  HasChompBase10<SRC>;

export type GetHasStringCoreSRC<CORE extends HasStringCore<any>> =
  CORE extends HasStringCore<infer SRC> ? SRC : never;

export type HasIsCharCode<SRC> = {
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
  isCharCode(
    code: number,
    offset: number,
    src: SRC
  ): Promise<boolean> | boolean;
};

export type HasConsumeBase16<SRC> = {
  /**
   * Consume all characters in base 16.
   *
   * @example
   * ```ts
   *    consumeBase16(0, "ABCDEF0123456789")
   *      // => [16, 12379813738877118000]
   *    consumeBase16(3, "åäöABCDEF!StopABCDEF")
   *      // => [9, 11259375]
   * ```
   *
   * @param offset - where in the string to start consuming
   * @returns a new offset and the consumed number converted to base 10
   *
   * @category Numbers
   */
  consumeBase16(
    offset: number,
    src: SRC
  ): Promise<[number, number]> | [number, number];
};

export type HasConsumeBase<SRC> = {
  /**
   * Consume all characters in a given base.
   *
   * @example
   * ```ts
   *  consumeBase(8, 0, "0123456789")
   *    // => [8, 342391]
   *  consumeBase(8, 1, "999")
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
    offset: number,
    src: SRC
  ): Promise<[number, number]> | [number, number];
};

export type HasChompBase10<SRC> = {
  /**
   *
   * Skips number characters, a.k.a. any one of 1,2,3,4,5,6,7,8,9
   *
   * @example
   * ```ts
   * chompBase10("aaaaaaaaaa1928a", 2)  // => 2
   * chompBase10("aaaaaaaaaa1928a", 10) // => 14
   * ```
   *
   * @param offset - the offset to start looking from
   * @returns the new offset after "removing" all base 10 numbers
   *
   * @category Numbers
   */
  chompBase10(offset: number, src: SRC): number;
};
