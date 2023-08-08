/**
 * Ordering is a type that represents the result of a comparison between two values.
 */
export enum Ordering {
  LT = -1,
  EQ = 0,
  GT = 1,
}

/**
 * Compare two values and return an Ordering.
 */
export type Compare<T> = (a: T, b: T) => Ordering;

/**
 * Compare two numbers and return an Ordering.
 *
 * @param a the first number
 * @param b the second number
 * @returns an Ordering
 */
export function compareNumber(a: number, b: number): Ordering {
  return a < b ? Ordering.LT : a > b ? Ordering.GT : Ordering.EQ;
}

/**
 * Compare two strings and return an Ordering.
 *
 * @param a the first string
 * @param b the second string
 * @returns an Ordering
 */
export function compareString(a: string, b: string): Ordering {
  return a < b ? Ordering.LT : a > b ? Ordering.GT : Ordering.EQ;
}

export interface IComparable {
  compareTo(other: IComparable): Ordering;
  equals(other: IComparable): boolean;
  lessThan(other: IComparable): boolean;
  greaterThan(other: IComparable): boolean;
}
