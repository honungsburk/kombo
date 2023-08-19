import * as StringHelpers from "../Helpers.js";
import * as Types from "./Types.js";

export type StringCore = Types.HasCore<string, string, string> &
  Types.HasStringCore<string>;

export const core: StringCore = {
  chompBase10: StringHelpers.chompBase10,
  isCharCode: StringHelpers.isCharCode,
  consumeBase16: StringHelpers.consumeBase16,
  consumeBase: StringHelpers.consumeBase,
  isSubToken: StringHelpers.isSubChar,
  isSubChunk: StringHelpers.isSubString,
  findSubChunk: (subChunk, offset, row, col, src) => {
    const [newOffset, newRow, newCol] = StringHelpers.findSubString(
      subChunk,
      offset,
      row,
      col,
      src
    );
    const didMatch = newOffset !== -1;
    return [didMatch, didMatch ? newOffset : src.length, newRow, newCol];
  },
  isEnd: (offset, src) => offset >= src.length,
  slice: (startOffset, endOffset, src) => src.slice(startOffset, endOffset),
};
