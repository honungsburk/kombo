import ISource from "./ISource.js";

export default class ArraySource<A> implements ISource<A, A[]> {
  constructor(
    private src: ReadonlyArray<A>,
    private eqToken: (l: A, r: A) => boolean
  ) {}

  isSubToken(predicate: (token: A) => boolean, offset: number): number {
    return offset < this.src.length && predicate(this.src[offset])
      ? offset + 1
      : -1;
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
      if (isGood) {
        col++;
      }
    }

    return [isGood ? offset : -1, 1, col];
  };

  findSubChunk(
    subChunk: A[],
    offset: number,
    row: number,
    col: number
  ): [number, number, number] {
    // We need to check each possible starting point
    // But when the subchunk is longer than what is left of the source, we can
    // stop early
    const interations = this.src.length - subChunk.length + 1;

    for (let i = offset; i < interations; i++) {
      const [newOffset, _newRow, newCol] = this.isSubChunk(
        subChunk,
        i,
        1,
        col + i
      );
      if (newOffset !== -1) {
        return [i, 1, col + i];
      }
    }

    return [-1, 1, this.src.length + 1];
  }
}
