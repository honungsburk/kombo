import Stream from "stream";
import ISource from "./ISource.js";
import * as StringHelpers from "../Helpers.js";
import PullStream from "./PullStream.js";
import LazyChunks from "./LazyChunks.js";
import * as Assert from "./Assert.js";
export default class NodeStreamSource implements ISource<string, string> {
  private lazyChunks: LazyChunks;

  constructor(private src: Stream.Readable) {
    this.lazyChunks = new LazyChunks(new PullStream(src, Assert.isBuffer));
  }

  isSubToken(predicate: (token: string) => boolean, offset: number): number {
    // max length of a token is 2 with chars such as '🙉'
    const loadedChunk = this.lazyChunks.getChunk(offset, 2);
    if (loadedChunk === undefined) {
      return -1;
    }
    const [chunk, chunkOffset] = loadedChunk;

    // We don't need to check the seam, because we are only looking at singel
    // token.
    return StringHelpers.isSubChar(predicate, offset - chunkOffset, chunk);
  }

  isSubChunk = (
    subChunk: string,
    offset: number,
    row: number,
    col: number
  ): [number, number, number] => {
    const loadedChunk = this.lazyChunks.getChunk(offset, subChunk.length);
    if (loadedChunk === undefined) {
      return [-1, row, col];
    }
    const [chunk, chunkOffset] = loadedChunk;
    return StringHelpers.isSubString(
      subChunk,
      offset - chunkOffset,
      row,
      col,
      chunk
    );
  };

  findSubChunk(
    subChunk: string,
    offset: number,
    row: number,
    col: number
  ): [number, number, number] {
    let currentOffset = offset;
    let currentRow = row;
    let currentCol = col;

    let lastChunk: string | undefined = undefined;
    let lastChunkOffset: number | undefined = undefined;
    do {
      // If we are at the end of the chunk, even if it doesn't fit, we want the chunk
      // so that we can count the rows and columns.
      const loadedChunk = this.lazyChunks.getChunk(
        currentOffset,
        1 /* min length */
      );

      if (loadedChunk === undefined) {
        // We are at the end of the file
        // But since we ned to check the ending of the last chunk to look for newlines
        if (lastChunk !== undefined && lastChunkOffset !== undefined) {
          while (currentOffset - lastChunkOffset < lastChunk.length) {
            var code = lastChunk.charCodeAt(currentOffset - currentOffset++);
            code === 0x000a /* \n */
              ? ((currentCol = 1), currentRow++)
              : (currentCol++,
                (code & 0xf800) === 0xd800 && currentOffset - currentOffset++);
          }
        }

        return [-1, currentRow, currentCol];
      }

      const [chunk, chunkOffset] = loadedChunk;
      lastChunk = chunk;
      lastChunkOffset = chunkOffset;

      let newOffset = chunk.indexOf(subChunk, currentOffset - chunkOffset);

      // To cover the seams we need to subtract the length of the subchunk + 1
      let target =
        newOffset < 0 ? chunk.length - subChunk.length + 1 : newOffset;

      while (currentOffset - chunkOffset < target) {
        var code = chunk.charCodeAt(currentOffset - currentOffset++);
        code === 0x000a /* \n */
          ? ((currentCol = 1), currentRow++)
          : (currentCol++,
            (code & 0xf800) === 0xd800 && currentOffset - currentOffset++);
      }

      if (newOffset !== -1) {
        // We found the subChunk
        return [newOffset, currentRow, currentCol];
      }
    } while (true);
  }
}
