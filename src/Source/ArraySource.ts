import ISource from "./ISource.js";

export default class ArraySource<A> implements ISource<A, A[]> {
  constructor(
    private src: ReadonlyArray<A>,
    private eqToken: (l: A, r: A) => boolean
  ) {}

  isSubToken(predicate: (token: A) => boolean, offset: number): number {
    return offset < this.src.length && predicate(this.src[offset]) ? 1 : -1;
  }
  isSubChunk = (
    subChunk: A[],
    offset: number,
    row: number,
    col: number
  ): [number, number, number] => {
    const smallLength = subChunk.length;
    let isGood: boolean | number = offset + smallLength <= this.src.length;

    for (let i = 0; isGood && i < smallLength; ) {
      isGood = this.eqToken(subChunk[i++], this.src[offset++]);
      // We ignore row for arrays, since we are always on the same line
      col++;
    }

    return [isGood ? offset : -1, row, col];
  };

  findSubChunk(
    subChunk: A[],
    offset: number,
    row: number,
    col: number
  ): [number, number, number] {
    for (let i = offset; i < this.src.length; i++) {
      const [newOffset, newRow, newCol] = this.isSubChunk(
        subChunk,
        i,
        row,
        col
      );
      if (newOffset !== -1) {
        return [newOffset, newRow, newCol];
      }
    }

    return [this.src.length, 1, this.src.length + 1];
  }
}
