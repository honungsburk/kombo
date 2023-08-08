import * as Ordering from "./Ordering.js";

/**
 * 1. We need to know if we are at the end of the stream
 * 2. To support chomping we need to get a slice between two indexes
 * 3. Copy megaparsecs definition of a stream
 *
 * NOTE: I'm 100% confident we need to sprinkle some promises for this to work.
 */
export type Stream<
  TOKEN extends Ordering.IComparable,
  CHUNK extends Ordering.IComparable
> = {
  // The offset we are at
  // offset: number;
  tokenToChunk: (token: TOKEN) => CHUNK;
  tokensToChunk: (tokens: TOKEN[]) => CHUNK;
  chunkToTokens: (chunk: CHUNK) => TOKEN[];
  chunkLength: (chunk: CHUNK) => number;
  chunkEmpty: (chunk: CHUNK) => boolean; // Should have a default impl

  /**
   * Extract a singel token from the stream. Return undefined if the
   * stream is empty.
   */
  take1: () => [TOKEN, Stream<TOKEN, CHUNK>] | undefined;

  /**
   * Extract a chunk from the stream.
   */
  takeN: (n: number) => [CHUNK, Stream<TOKEN, CHUNK>] | undefined;

  /**
   * Take tokens from a stream while the provided predicate returns `true`
   */
  takeWhile: (
    predicate: (token: TOKEN) => boolean
  ) => [CHUNK, Stream<TOKEN, CHUNK>];
};

export abstract class BaseStream<
  TOKEN extends Ordering.IComparable,
  CHUNK extends Ordering.IComparable
> implements Stream<TOKEN, CHUNK>
{
  // Stream manipulation
  abstract tokensToChunk: (tokens: TOKEN[]) => CHUNK;
  abstract chunkToTokens: (chunk: CHUNK) => TOKEN[];
  abstract chunkLength: (chunk: CHUNK) => number;

  abstract take1: () => [TOKEN, Stream<TOKEN, CHUNK>] | undefined;

  abstract takeN: (n: number) => [CHUNK, Stream<TOKEN, CHUNK>] | undefined;

  abstract takeWhile: (
    predicate: (token: TOKEN) => boolean
  ) => [CHUNK, Stream<TOKEN, CHUNK>];

  // Default implementations
  chunkEmpty(chunk: CHUNK) {
    return this.chunkLength(chunk) === 0;
  }

  tokenToChunk(token: TOKEN) {
    return this.tokensToChunk([token]);
  }
}

// import * as fs from "fs";
// const stream = fs.createReadStream("file.txt");
// stream.on("data", (chunk) => {
//   console.log(chunk);
// });
