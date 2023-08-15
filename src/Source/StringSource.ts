import * as StringHelpers from "../Helpers.js";
import IStringSource from "./IStringSource.js";

export default class StringSource implements IStringSource {
  constructor(private src: string) {}
  chompBase10(offset: number): number {
    return StringHelpers.chompBase10(offset, this.src);
  }
  isCharCode(code: number, offset: number): boolean {
    return StringHelpers.isCharCode(code, offset, this.src);
  }
  consumeBase16(offset: number): [number, number] {
    return StringHelpers.consumeBase16(offset, this.src);
  }
  consumeBase(base: number, offset: number): [number, number] {
    return StringHelpers.consumeBase(base, offset, this.src);
  }

  isSubToken(predicate: (token: string) => boolean, offset: number): number {
    return StringHelpers.isSubChar(predicate, offset, this.src);
  }
  isSubChunk = (
    subChunk: string,
    offset: number,
    row: number,
    col: number
  ): [number, number, number] => {
    return StringHelpers.isSubString(subChunk, offset, row, col, this.src);
  };

  findSubChunk(
    subChunk: string,
    offset: number,
    row: number,
    col: number
  ): [boolean, number, number, number] {
    const [newOffset, newRow, newCol] = StringHelpers.findSubString(
      subChunk,
      offset,
      row,
      col,
      this.src
    );
    const didMatch = newOffset !== -1;
    return [didMatch, didMatch ? newOffset : this.src.length, newRow, newCol];
  }

  isEnd(offset: number): boolean {
    return offset >= this.src.length;
  }

  slice(startOffset: number, endOffset: number): string | Promise<string> {
    return this.src.slice(startOffset, endOffset);
  }
}
