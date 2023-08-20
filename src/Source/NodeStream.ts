import Stream from "stream";
import PullStream from "./PullStream.js";
import LazyChunks from "./LazyChunks.js";
import * as Assert from "./Assert.js";
import * as StringHelpers from "../Helpers.js";
import * as Types from "./Types.js";

export type NodeStreamCore = Types.HasCore<LazyChunks, string, string>;
// &  Types.HasStringCore<LazyChunks>;

export const core: NodeStreamCore = {
  // chompBase10: StringHelpers.chompBase10,
  // isCharCode: StringHelpers.isCharCode,
  // consumeBase16: StringHelpers.consumeBase16,
  // consumeBase: StringHelpers.consumeBase,
  isSubToken: isSubToken,
  isSubChunk: isSubChunk,
  findSubChunk: findSubChunk,
  isEnd: isEnd,
  slice: slice,
};

/**
 * Checks if the source is at the end.
 *
 * @param offset
 * @param src
 * @returns
 */
export async function isEnd(offset: number, src: LazyChunks): Promise<boolean> {
  const res = src.getChunk(offset, 1);
  return res === undefined;
}

/**
 *
 * @param startOffset
 * @param endOffset
 * @param src
 * @returns
 */
export async function slice(
  startOffset: number,
  endOffset: number,
  src: LazyChunks
): Promise<string> {
  const chunk = await src.getChunk(startOffset, endOffset - startOffset);

  if (chunk === undefined) {
    // TODO: Investigate a design that avoid throwing errors
    throw new Error("Slice out of bounds");
  }

  const [chunkStr, chunkOffset] = chunk;
  return chunkStr.slice(startOffset - chunkOffset, endOffset - chunkOffset);
}

/**
 *
 * @param predicate
 * @param offset
 * @param src
 * @returns
 */
export async function isSubToken(
  predicate: (token: string) => boolean,
  offset: number,
  src: LazyChunks
): Promise<number> {
  // max length of a token is 2 with chars such as '🙉'
  // So to make sure we have enough data we need to load 2 charcodes
  let loadedChunk = await src.getChunk(offset, 2);
  if (loadedChunk === undefined) {
    // It is still possible that we can load 1 charcode
    loadedChunk = await src.getChunk(offset, 1);
  }

  if (loadedChunk === undefined) {
    return -1;
  }
  const [chunk, chunkOffset] = loadedChunk;

  // We don't need to check the seam, because we are only looking at singel
  // token.
  return StringHelpers.isSubChar(predicate, offset - chunkOffset, chunk);
}

export async function isSubChunk(
  subChunk: string,
  offset: number,
  row: number,
  col: number,
  src: LazyChunks
): Promise<[number, number, number]> {
  const loadedChunk = await src.getChunk(offset, subChunk.length);
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
}

export async function findSubChunk(
  subChunk: string,
  offset: number,
  row: number,
  col: number,
  src: LazyChunks
): Promise<[boolean, number, number, number]> {
  let currentOffset = offset;
  let currentRow = row;
  let currentCol = col;

  // Subchunk
  let subChunkIndex = 0;

  // chunk

  // If we are at the end of the chunk, even if it doesn't fit, we want the chunk
  // so that we can count the rows and columns.
  const loadedChunk = await src.getChunk(currentOffset, 1);

  if (loadedChunk === undefined) {
    // We are at the end of the file
    return [false, currentOffset, currentRow, currentCol];
  }

  let chunk = loadedChunk[0];
  let chunkOffset = loadedChunk[1];

  while (true) {
    const baseOffset = currentOffset - chunkOffset;

    // Check if the subChunk matches
    // Be aware that we might have to continue over the seam
    while (true) {
      // First check if we can get the next charcode
      // From the current chunk, if not we need to load the next chunk
      if (chunk.length <= subChunkIndex + baseOffset) {
        // We need to load next chunk
        const loadedChunk = await src.getChunk(currentOffset, subChunk.length);

        // We are at the end
        if (loadedChunk === undefined) {
          // There still might be characters left, just not enough to fit the subChunk
          const loadedChunk = await src.getChunk(currentOffset, 2);
          if (loadedChunk === undefined) {
            return [false, currentOffset, currentRow, currentCol];
          } else {
            chunk = loadedChunk[0];
            chunkOffset = loadedChunk[1];
            // Calculate the new row and col
            const [newRow, newCol] = finalRowCol(
              chunk,
              currentOffset - chunkOffset,
              currentRow,
              currentCol
            );
            return [false, currentOffset, newRow, newCol];
          }
        }

        // Note: there is a problem if the new chunk at the subChunkIndex + baseOffset
        // is still to short.
        chunk = loadedChunk[0];
        chunkOffset = loadedChunk[1];
        break;
      }

      // We have the next charcode and can compare it to the subChunk
      if (
        subChunk.charCodeAt(subChunkIndex) ===
        chunk.charCodeAt(subChunkIndex + baseOffset)
      ) {
        subChunkIndex++;
        if (subChunkIndex === subChunk.length) {
          // We found the subChunk
          return [true, currentOffset, currentRow, currentCol];
        }
      } else {
        subChunkIndex = 0;
        break;
      }
    }

    // We need to check for newlines, because we need to count the rows and columns

    let code = chunk.charCodeAt(currentOffset++ - chunkOffset);

    // We need to check for newlines, because we need to count the rows and columns
    code === 0x000a /* \n */
      ? ((currentCol = 1), currentRow++)
      : (currentCol++,
        (code & 0xf800) === 0xd800 && currentOffset++ - chunkOffset);
  }
}

function finalRowCol(
  chunk: string,
  offset: number,
  row: number,
  col: number
): [number, number] {
  while (offset < chunk.length) {
    let code = chunk.charCodeAt(offset++);
    code === 0x000a /* \n */
      ? ((col = 1), row++)
      : (col++, (code & 0xf800) === 0xd800 && offset++);
  }
  return [row, col];
}
