/**
 * An abstract interface that the parser uses to access the source input. This
 * allows us to implement a source that is backed by a string, array, or a
 * node stream.
 *
 * TOKEN is a single token that can be extracted from the source.
 * CHUNK is a collection of tokens that can be extracted from the source.
 *
 * Example: TOKEN = number, CHUNK = number[]
 */
export default interface ISource<TOKEN, CHUNK> {
  isSubToken(predicate: (token: TOKEN) => boolean, offset: number): number;
  isSubChunk: (
    subChunk: CHUNK,
    offset: number,
    row: number,
    col: number
  ) => [number, number, number];
  findSubChunk(
    subChunk: CHUNK,
    offset: number,
    row: number,
    col: number
  ): [number, number, number];
}
