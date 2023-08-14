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

  async isSubToken(
    predicate: (token: string) => boolean,
    offset: number
  ): Promise<number> {
    // max length of a token is 2 with chars such as '🙉'
    // So to make sure we have enough data we need to load 2 charcodes
    let loadedChunk = await this.lazyChunks.getChunk(offset, 2);
    if (loadedChunk === undefined) {
      // It is still possible that we can load 1 charcode
      loadedChunk = await this.lazyChunks.getChunk(offset, 1);
    }

    if (loadedChunk === undefined) {
      return -1;
    }
    const [chunk, chunkOffset] = loadedChunk;

    // We don't need to check the seam, because we are only looking at singel
    // token.
    return StringHelpers.isSubChar(predicate, offset - chunkOffset, chunk);
  }

  async isSubChunk(
    subChunk: string,
    offset: number,
    row: number,
    col: number
  ): Promise<[number, number, number]> {
    const loadedChunk = await this.lazyChunks.getChunk(offset, subChunk.length);
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

  async findSubChunk(
    subChunk: string,
    offset: number,
    row: number,
    col: number
  ): Promise<[number, number, number]> {
    let currentOffset = offset;
    let currentRow = row;
    let currentCol = col;

    // Subchunk
    let subChunkIndex = 0;

    // chunk

    // If we are at the end of the chunk, even if it doesn't fit, we want the chunk
    // so that we can count the rows and columns.
    const loadedChunk = await this.lazyChunks.getChunk(currentOffset, 1);

    if (loadedChunk === undefined) {
      // We are at the end of the file
      return [-1, currentRow, currentCol];
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
          const loadedChunk = await this.lazyChunks.getChunk(
            currentOffset,
            subChunk.length
          );

          // We are at the end
          if (loadedChunk === undefined) {
            // There still might be characters left, just not enough to fit the subChunk
            const loadedChunk = await this.lazyChunks.getChunk(
              currentOffset,
              2
            );
            if (loadedChunk === undefined) {
              return [-1, currentRow, currentCol];
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
              return [-1, newRow, newCol];
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
            return [currentOffset, currentRow, currentCol];
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

// async findSubChunk(
//   subChunk: string,
//   offset: number,
//   row: number,
//   col: number
// ): Promise<[number, number, number]> {
//   let currentOffset = offset;
//   let currentRow = row;
//   let currentCol = col;

//   let lastChunk: string | undefined = undefined;
//   let lastChunkOffset: number | undefined = undefined;
//   do {
//     // If we are at the end of the chunk, even if it doesn't fit, we want the chunk
//     // so that we can count the rows and columns.
//     const loadedChunk = await this.lazyChunks.getChunk(
//       currentOffset,
//       1 /* min length */
//     );

//     if (loadedChunk === undefined) {
//       // We are at the end of the file
//       // But since we ned to check the ending of the last chunk to look for newlines
//       if (lastChunk !== undefined && lastChunkOffset !== undefined) {
//         while (currentOffset - lastChunkOffset < lastChunk.length) {
//           let code = lastChunk.charCodeAt(currentOffset++ - lastChunkOffset);
//           code === 0x000a /* \n */
//             ? ((currentCol = 1), currentRow++)
//             : (currentCol++,
//               (code & 0xf800) === 0xd800 &&
//                 currentOffset++ - lastChunkOffset);
//         }
//       }

//       return [-1, currentRow, currentCol];
//     }

//     const [chunk, chunkOffset] = loadedChunk;
//     lastChunk = chunk;
//     lastChunkOffset = chunkOffset;

//     let newOffset = chunk.indexOf(subChunk, currentOffset - chunkOffset);

//     // To cover the seams we need to subtract the length of the subchunk + 1
//     let target =
//       newOffset < 0 ? chunk.length - subChunk.length + 1 : newOffset;

//     while (currentOffset - chunkOffset < target) {
//       let code = chunk.charCodeAt(currentOffset++ - chunkOffset);
//       code === 0x000a /* \n */
//         ? ((currentCol = 1), currentRow++)
//         : (currentCol++,
//           (code & 0xf800) === 0xd800 && currentOffset++ - chunkOffset);
//     }

//     if (newOffset !== -1) {
//       // We found the subChunk
//       return [newOffset, currentRow, currentCol];
//     }
//   } while (true);
// }
// }
