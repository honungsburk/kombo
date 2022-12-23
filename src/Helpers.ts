// STRINGS

/**
 * Check if one string is a sub-string of another.
 *
 * @remarks
 *
 * When making a fast parser, you want to avoid allocation as much as
 * possible. That means you never want to mess with the source string, only
 * keep track of an offset into that string.
 *
 * @example
 * Here is a simple example:
 * ```ts
 * isSubString("let", offset, row, col, "let x = 4 in x")
 *   // => [newOffset, newRow, newCol]
 * ```
 *
 * You are looking for `"let"` at a given `offset`. On failure, the
 * `newOffset` is `-1`. On success, the `newOffset` is the new offset.
 * Our `"let"` example would be `offset + 3`.
 *
 * You also provide the current `row` and `col` which do not align with
 * `offset` in a clean way. For example, when you see a `\n` you are at
 * `row = row + 1` and `col = 1`. Furthermore, some UTF16 characters are
 * two words wide, so even if there are no newlines, `offset` and `col`
 * may not be equal.
 *
 * @category Uses offset
 */
export function isSubString(
  smallString: string,
  offset: number,
  row: number,
  col: number,
  bigString: string
): [number, number, number] {
  const smallLength = smallString.length;
  let isGood: boolean | number = offset + smallLength <= bigString.length;

  for (let i = 0; isGood && i < smallLength; ) {
    const code = bigString.charCodeAt(offset);
    isGood =
      smallString[i++] === bigString[offset++] &&
      (code === 0x000a /* \n */
        ? (row++, (col = 1))
        : (col++,
          (code & 0xf800) === 0xd800
            ? smallString[i++] === bigString[offset++]
            : 1));
  }

  return [isGood ? offset : -1, row, col];
}

/** Again, when parsing, you want to allocate as little as possible.
 * So this function lets you say:
 *
 * ```ts
 * isSubChar(isSpace, offset, "this is the source string") // => newOffset
 * ```
 *
 * The `(Char -> Bool)` argument is called a predicate.
 * The `newOffset` value can be a few different things:
 *
 * - `-1` means that the predicate failed
 * - `-2` means the predicate succeeded with a `\n`
 * - otherwise you will get `offset + 1` or `offset + 2`
 *   depending on whether the UTF16 character is one or two
 *   words wide.
 *
 * @category Uses offset
 */
export function isSubChar(
  predicate: (src: string) => boolean,
  offset: number,
  string: string
): number {
  return string.length <= offset
    ? -1
    : (string.charCodeAt(offset) & 0xf800) === 0xd800
    ? predicate(string.substr(offset, 2))
      ? offset + 2
      : -1
    : predicate(string[offset])
    ? string[offset] === "\n"
      ? -2
      : offset + 1
    : -1;
}

/**
 *
 * Check if the character at the given offset has the given charcode.
 *
 * @example
 * ```ts
 *    isCharCode(1,  97, "aaa")             // => true
 *    isCharCode(10, 97, "aaaaaaaaaaäaaaa") // => false
 * ```
 *
 * @param code - the character code to check against
 * @param offset - the offset into the string
 * @param string - the source string
 * @returns true if the character at the given offset has the given code, otherwise false
 *
 * @category Uses offset
 */
export function isCharCode(
  code: number,
  offset: number,
  string: string
): boolean {
  return string.charCodeAt(offset) === code;
}

/**
 * Check that a string only consists of alphanumeric characters.
 *
 * ```ts
 *     isAlphaNum("abcdefghijklmnopqrstuvxyz") => true
 *     isAlphaNum("ABCDEFGHIJKLMNOPQRSTUVXYZ") => true
 *     isAlphaNum("1234567890")                => true
 *     isAlphaNum("=")                         => false
 * ```
 *
 * @param string - the string of characters
 * @return true if it only contains alphanumeric characters.
 *
 * @category Is
 */
export function isAlphaNum(string: string): boolean {
  // 48  => '0'
  // 57  => '9'
  // 65  => 'A'
  // 90  => 'Z'
  // 97  => 'a'
  // 122 => 'z'
  return checkAllChars(
    (c) =>
      (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122),
    string
  );
}

/**
 * Check that a string only consists of digits.
 *
 * @example
 * ```ts
 *     isDigit("abcdefghijklmnopqrstuvxyz") // => false
 *     isDigit("ABCDEFGHIJKLMNOPQRSTUVXYZ") // => false
 *     isDigit("1234567890")                // => true
 *     isDigit("=")                         // => false
 * ```
 *
 * @category Is
 *
 * @param string - the string of characters
 * @returns True if it only contains alphanumeric characters.
 */
export function isDigit(string: string): boolean {
  // 48  => '0'
  // 57  => '9'
  return checkAllChars((c) => c >= 48 && c <= 57, string);
}

/**
 * Check that a string only consists of lower-case characters
 *
 * ```ts
 *     isLower("abcdefghijklmnopqrstuvxyz") // => true
 *     isLower("A")                         // => false
 *     isLower("abcdefghijKlmnopqrstuvxyz") // => false
 * ```
 *
 * @param string - the string of characters
 * @return true if it only contains alphanumeric characters.
 *
 * @category Is
 */
export function isLower(string: string): boolean {
  // 97  => 'a'
  // 122 => 'z'
  return checkAllChars((c) => c >= 97 && c <= 122, string);
}

/**
 *
 * Check that a string only consists of uppercase characters
 *
 * ```ts
 *     isUpper("abcdefghijKlmnopqrstuvxyz") // => true
 *     isUpper("ABCDEFGHIJKLmNOPQRSTUVXYZ") // => false
 *     isUpper("=")                         // => false
 * ```
 *
 * @param string - the string of characters
 * @return true if it only contains uppercase characters.
 *
 * @category Is
 */
export function isUpper(string: string): boolean {
  // 65  => 'A'
  // 90  => 'Z'
  return checkAllChars((c) => c >= 65 && c <= 90, string);
}

function checkAllChars(
  isGood: (c: number) => boolean,
  string: string
): boolean {
  for (let i = 0; i < string.length; i++) {
    const c = string.charCodeAt(i);
    if (!isGood(c)) {
      return false;
    }
  }

  return true;
}

// NUMBERS

/**
 *
 * Skips number characters, a.k.a. any one of 1,2,3,4,5,6,7,8,9
 *
 * @example
 * ```ts
 * chompBase10(2, "aaaaaaaaaa1928a")  // => 2
 * chompBase10(10, "aaaaaaaaaa1928a") // => 14
 * ```
 *
 * @param offset - the offset to start looking from
 * @param string - the source string
 * @returns the new offset after "removing" all base 10 numbers
 *
 * @category Numbers
 */
export function chompBase10(offset: number, string: string): number {
  for (; offset < string.length; offset++) {
    var code = string.charCodeAt(offset);
    /**
     * 0x30 => 1
     * 0x39 => 9
     */
    if (code < 0x30 || 0x39 < code) {
      return offset;
    }
  }
  return offset;
}

/**
 * Consume all characters in a given base.
 *
 * @example
 * ```ts
 * consumeBase(8, 0, "0123456789")  // => [8, 342391]
 * consumeBase(8, 1, "999")         // => [1, 0]
 * ```
 *
 * @param base    - the base to use i.e. one of 2, 3, 4, 5 ,...
 * @param offset  - where in the string to start consuming
 * @param string  - the source string
 * @returns the new offset and the number it consumed converted to base 10
 *
 * @category Numbers
 */
export function consumeBase(
  base: number,
  offset: number,
  string: string
): [number, number] {
  for (var total = 0; offset < string.length; offset++) {
    var digit = string.charCodeAt(offset) - 0x30;
    if (digit < 0 || base <= digit) break;
    total = base * total + digit;
  }
  return [offset, total];
}

/**
 * Consume all characters in base 16.
 *
 * @example
 * ```ts
 * consumeBase16(0, "ABCDEF0123456789")
 *    // => [16, 12379813738877118000]
 * consumeBase16(3, "åäöABCDEF!StopABCDEF")
 *    // => [9, 11259375]
 * ```
 *
 * @param offset - where in the string to start consuming
 * @param string - the source string
 * @returns a new offset and the consumed number converted to base 10
 *
 * @category Numbers
 */
export function consumeBase16(
  offset: number,
  string: string
): [number, number] {
  for (var total = 0; offset < string.length; offset++) {
    var code = string.charCodeAt(offset);
    if (0x30 <= code && code <= 0x39) {
      total = 16 * total + code - 0x30;
    } else if (0x41 <= code && code <= 0x46) {
      total = 16 * total + code - 55;
    } else if (0x61 <= code && code <= 0x66) {
      total = 16 * total + code - 87;
    } else {
      break;
    }
  }
  return [offset, total];
}

// FIND STRING

/**
 * Find a substring after a given offset.
 *
 * @example
 * ```ts
 * findSubString("42", 0, 1, 1, "Is 42 the answer?")
 *    // => [3, 1, 4]
 * findSubString("42", 7, 1, 8, "Is 42 the answer?")
 *    // => [-1, 1, 18]
 * findSubString("🙉", 0, 1, 1, "🙈\n\n\n1🙊🙉🙊")
 *    // => [8, 4, 3,]
 * ```
 *
 * Note that "🙉" is two bytes long in UTF-16 and that offset is counted in bytes.
 *
 * @remarks
 * Returns offset, row, and column. In that order.
 *
 * @category Uses offset
 */
export function findSubString(
  smallString: string,
  offset: number,
  row: number,
  col: number,
  bigString: string
): [number, number, number] {
  var newOffset = bigString.indexOf(smallString, offset);
  var target = newOffset < 0 ? bigString.length : newOffset;

  while (offset < target) {
    var code = bigString.charCodeAt(offset++);
    code === 0x000a /* \n */
      ? ((col = 1), row++)
      : (col++, (code & 0xf800) === 0xd800 && offset++);
  }

  return [newOffset, row, col];
}
