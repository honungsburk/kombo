import Stream from "stream";
import ISource from "./ISource.js";
import * as StringHelpers from "../Helpers.js";
import PullStream from "./PullStream.js";

////////////////////////////////////////////////////////////////////////////////
// LazyChunks
////////////////////////////////////////////////////////////////////////////////

/**
 *  Lazy chunks is a wrapper around a pull stream that keeps the last N chunks in
 *  memory. This allows us to do backtracking within the last N chunks, and allow
 *  us to match over several chunks.
 */
class LazyChunks {
  // keep track of the last N chunks in memory, anything before that is
  // discarded.
  private lastNChunks: string[] = [];
  private superChunk: string | null = null;

  // offset before the first chunk still in memory
  private totalNChunkLength = 0;
  private currentOffset: number = 0;

  // Settings
  private maxChunks: number;

  constructor(
    private pullStream: PullStream<Buffer>,
    config?: { maxChunks: number }
  ) {
    this.maxChunks = config?.maxChunks ?? 2;
  }

  private assertValidOffset(offset: number) {
    if (offset < this.currentOffset) {
      throw new Error(
        `Chunk is forgotten. Wants offset ${offset} but current offset is ${this.currentOffset}`
      );
    }
  }

  // Get the chunk with the given offset. If the chunk is not in memory,

  /**
   * Get the chunk with the given offset. If the chunk is not in memory,
   * read the next chunk from the file and add it to memory.
   * @param offset
   */
  getChunk(
    offset: number,
    minLengthFromOffset: number
  ): [string, number] | undefined {
    if (offset < this.currentOffset + this.totalNChunkLength) {
      // The chunk is in memory

      const chunks = [];
      const chunkOffset = offset - this.currentOffset;
      for (let chunk in this.lastNChunks) {
        chunkOffset;
      }
    } else {
      // The chunk is to be loaded from the stream
      // Could be Buffer, Uint8Array or string (or javascript objec if in object mode)
      // const res: null | Buffer = this.src.read();
      // If someone else reads from the stream, and not we. Will we then loose
      // the data?
    }

    throw new Error("Method not implemented.");
  }

  private loadChunk(
    offset: number,
    minLengthFromOffset: number
  ): [string, number] {
    throw new Error("Method not implemented.");
    // If we try to load a chunk, and receive null we might need to wait for
    // the next chunk to be available. We can do this by using the 'readable'
    // event.

    if (this.superChunk === null) {
      // const chunk = this.src.read();
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// NodeStreamSource
////////////////////////////////////////////////////////////////////////////////

function assertIsBuffer(x: any): asserts x is Buffer {
  if (!(x instanceof Buffer)) {
    throw new Error("Expected a buffer");
  }
}
export default class NodeStreamSource implements ISource<string, string> {
  private lazyChunks: LazyChunks;

  constructor(private src: Stream.Readable, config?: { maxChunks: number }) {
    this.lazyChunks = new LazyChunks(
      new PullStream(src, assertIsBuffer),
      config
    );
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
      let target = newOffset < 0 ? chunk.length - chunk.length + 1 : newOffset;

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
