import * as StringHelpers from "../Helpers.js";
import ISource from "./ISource.js";

export default class StringSource implements ISource<string, string> {
  constructor(private src: string) {}

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
  ): [number, number, number] {
    return StringHelpers.findSubString(subChunk, offset, row, col, this.src);
  }
}
