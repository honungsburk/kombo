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
  getChunk(offset: number, minLengthFromOffset: number): [string, number] {
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
    const [chunk, chunkOffset] = this.lazyChunks.getChunk(offset, 2);

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
    const [chunk, chunkOffset] = this.lazyChunks.getChunk(
      offset,
      subChunk.length
    );
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
    const [chunk, chunkOffset] = this.lazyChunks.getChunk(
      offset,
      subChunk.length
    );

    // a subChunk can not be larger then the chunk size. Because then it is so large
    // that we can't check it against the source we keeep in memory. In practice
    // this should not be a problem, because subChunks are usually small and chunks
    // are usually large.

    // Note that a subChunk can span multiple chunks in memory. We need to
    // then check the seam.
    throw new Error("Method not implemented.");
  }
}
