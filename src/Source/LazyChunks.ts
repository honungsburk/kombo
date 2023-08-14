import PullStream from "./PullStream.js";

enum Loaded {
  YES,
  NO,
  ALREADY_LOADED,
}

/**
 *  Lazy chunks is a wrapper around a pull stream that keeps the last N chunks in
 *  memory. This allows us to do backtracking within the last N chunks, and allow
 *  us to match over several chunks.
 */
export default class LazyChunks {
  // keep track of the last N chunks in memory, anything before that is
  // discarded.
  private chunk1: string | undefined = undefined;
  get chunk1Length(): number {
    return this.chunk1?.length ?? 0;
  }
  private chunk2: string | undefined = undefined;
  get chunk2Length(): number {
    return this.chunk2?.length ?? 0;
  }

  private totalChunk: string = "";

  // offset before the first chunk still in memory
  private currentOffset: number = 0;

  constructor(private pullStream: PullStream<Buffer>) {}

  // Returns true if a chunk was loaded
  private async loadNextChunk(): Promise<boolean> {
    const chunk = await this.pullStream.pull();
    if (chunk === null) {
      return false;
    }

    if (this.chunk1 === undefined) {
      this.chunk1 = chunk.toString("utf8");
      this.totalChunk = this.chunk1;
      return true;
    }

    if (this.chunk2 !== undefined) {
      this.currentOffset += this.chunk1.length;
      this.chunk1 = this.chunk2;
    }
    //TODO: We can't just assume utf8 here.
    this.chunk2 = chunk.toString("utf8");
    this.totalChunk = this.chunk1 + this.chunk2;
    return true;
  }

  /**
   * Get the chunk with the given offset. If the chunk is not in memory,
   * read the next chunk from the file and add it to memory.
   * @param offset
   */
  async getChunk(
    offset: number,
    minLengthFromOffset: number
  ): Promise<[string, number] | undefined> {
    if (offset < this.currentOffset) {
      throw new Error(
        `Chunk is forgotten. Wants offset ${offset} but current offset is ${this.currentOffset}`
      );
    }

    // If we never loaded a chunk, we need to load one.
    if (this.chunk1 === undefined) {
      const didLoad = await this.loadNextChunk();
      if (!didLoad) {
        return undefined;
      }
    }

    do {
      if (
        offset < this.currentOffset + this.totalChunk.length &&
        offset + minLengthFromOffset <=
          this.currentOffset + this.totalChunk.length
      ) {
        return [this.totalChunk, this.currentOffset];
      }

      if (
        // The offset is after the current loaded chunks
        offset >= this.currentOffset + this.totalChunk.length ||
        // the chunk is to short, but we can load the next chunk and see if it is long enough
        offset > this.currentOffset + this.chunk1Length ||
        this.chunk2 === undefined
      ) {
        const loadResult = await this.loadNextChunk();
        if (!loadResult) {
          // if we can't load the next chunk, we are at the end of the stream.
          return undefined;
        }
      } else {
        // The chunk is to short and we can't load the next chunk, so we throw an error.
        throw new Error(
          `Chunk to small. minLengthFromOffset: ${minLengthFromOffset} is too big.`
        );
      }
    } while (true);
  }
}
