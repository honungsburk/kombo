// Note: should be put in a seperate repository... assumes node.js
//
// - If we take streams in, we also need to return a stream as output in the parser.
// - No backtracking larger then the chunk size of the stream. Otherwise we need to
//   buffer the entire stream in memory.
import Stream from "stream";
import ISource from "./ISource.js";

// streams can operate on strings, buffers or Uint8Arrays
// stream can work on arbitrary objects, if they are put in object mode
// streams can not emit null. If you want to emit null, use undefined.

export default class NodeStreamSource implements ISource<string, string> {
  // keep track of the last N chunks in memory, anything before that is
  // discarded.
  private lastNChunks: string[] = [];

  // offset before the first chunk still in memory
  private totalNChunkLength = 0;
  private currentOffset: number = 0;

  // Settings
  private maxChunks: number;

  constructor(private src: Stream.Readable, _config?: { maxChunks: number }) {
    this.maxChunks = _config?.maxChunks ?? 2;
  }

  // Get the chunk with the given offset. If the chunk is not in memory,

  /**
   * Get the chunk with the given offset. If the chunk is not in memory,
   * read the next chunk from the file and add it to memory.
   * @param offset
   */
  private getChunk(offset: number): string {
    if (offset < this.currentOffset) {
      // The chunk is forgotten
      throw new Error("Chunk is forgotten");
    } else if (offset < this.currentOffset + this.totalNChunkLength) {
      // The chunk is in memory
    } else {
      // The chunk is to be loaded from the stream

      // Could be Buffer, Uint8Array or string (or javascript objec if in object mode)
      const res: null | Buffer = this.src.read();
      // If someone else reads from the stream, and not we. Will we then loose
      // the data?
    }

    throw new Error("Method not implemented.");
  }

  isSubToken(predicate: (token: string) => boolean, offset: number): number {
    throw new Error("Method not implemented.");
  }
  isSubChunk = (
    subChunk: string,
    offset: number,
    row: number,
    col: number
  ): [number, number, number] => {
    // Note that a subChunk can span multiple chunks in memory. We need to
    // then check the seam.
    throw new Error("Method not implemented.");
  };

  findSubChunk(
    subChunk: string,
    offset: number,
    row: number,
    col: number
  ): [number, number, number] {
    // Note that a subChunk can span multiple chunks in memory. We need to
    // then check the seam.
    throw new Error("Method not implemented.");
  }
}
