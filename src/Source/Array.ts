import * as Types from "./Types.js";

export type ArrayCore<A> = Types.HasCore<A[], A[], A>;
export type EqFN<A> = (l: A, r: A) => boolean;

export const core = <A>(eqToken: EqFN<A>): ArrayCore<A> => ({
  isEnd: isEnd,
  isSubToken: isSubToken,
  isSubChunk: isSubChunk(eqToken),
  findSubChunk: findSubChunk(eqToken),
  slice: slice,
});

export function isEnd<A>(offset: number, src: A[]): boolean {
  return offset >= src.length;
}

export function isSubToken<A>(
  predicate: (token: A) => boolean,
  offset: number,
  src: A[]
): number {
  return offset < src.length && predicate(src[offset]) ? offset + 1 : -1;
}

export const isSubChunk =
  <A>(eqToken: EqFN<A>) =>
  (
    subChunk: A[],
    offset: number,
    row: number,
    col: number,
    src: A[]
  ): [number, number, number] => {
    let isGood: boolean | number = offset + subChunk.length <= src.length;

    for (let i = 0; isGood && i < subChunk.length; ) {
      isGood = eqToken(subChunk[i++], src[offset++]);
      // We ignore row for arrays, since we are always on the same line
      if (isGood) {
        col++;
      }
    }

    return [isGood ? offset : -1, 1, col];
  };

export const findSubChunk =
  <A>(eqToken: EqFN<A>) =>
  (
    subChunk: A[],
    offset: number,
    row: number,
    col: number,
    src: A[]
  ): [boolean, number, number, number] => {
    // We need to check each possible starting point
    // But when the subchunk is longer than what is left of the source, we can
    // stop early
    const interations = src.length - subChunk.length + 1;

    const _isSubChunk = isSubChunk(eqToken);

    for (let i = offset; i < interations; i++) {
      const [newOffset, _newRow, newCol] = _isSubChunk(
        subChunk,
        i,
        1,
        col + i,
        src
      );
      if (newOffset !== -1) {
        return [true, i, 1, col + i];
      }
    }

    // if the string is empty we want to return [false, 0, 1, 1] instead of [false, -1, 1, 1]
    // TODO: is this correct???
    const resOffset = Math.max(src.length - 1, 0);
    return [false, resOffset, 1, src.length];
  };

export function slice<A>(
  startOffset: number,
  endOffset: number,
  src: A[]
): A[] {
  return src.slice(startOffset, endOffset);
}
