import { test, Group } from "@japa/runner";
import * as H from "./Helpers.js";

function helpersGroup(fnName: string, callback: (group: Group) => void) {
  test.group(`Helpers.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@helpers", `@${fnName}`])
    );
    callback(group);
  });
}

// isSubString

helpersGroup("isSubString", () => {
  test("empty string in empty string", ({ expect }) => {
    expect(H.isSubString("", 0, 1, 1, "")).toStrictEqual([0, 1, 1]);
  });

  test("correct in a simple string", ({ expect }) => {
    expect(H.isSubString("let", 0, 1, 1, "let x = 4 in x")).toStrictEqual([
      3, 1, 4,
    ]);
  });

  test("incorrect in a simple string", ({ expect }) => {
    expect(H.isSubString("let", 1, 1, 2, "let x = 4 in x")).toStrictEqual([
      -1, 1, 2,
    ]);
  });

  test("malformed input", ({ expect }) => {
    expect(H.isSubString("let", 0, 1, 1, "lee x = 4 in x")).toStrictEqual([
      -1, 1, 3,
    ]);
  });

  test("handles newlines", ({ expect }) => {
    expect(
      H.isSubString("Hello,\nworld!", 6, 1, 7, "What?\nHello,\nworld!\nOkey?!")
    ).toStrictEqual([19, 2, 7]);
  });
});

// isSubChar

const isA = (c: string) => c === "a" || c === "\n" || c === "🙊";

helpersGroup("isSubChar", () => {
  test("check that a char is an 'a' and increment the offset", ({ expect }) => {
    expect(H.isSubChar(isA, 0, "a")).toStrictEqual(1);
    expect(H.isSubChar(isA, 4, "bbbbabbbb")).toStrictEqual(5);
  });

  test("return -1 when not an 'a'", ({ expect }) => {
    expect(H.isSubChar(isA, 0, "ä")).toStrictEqual(-1);
    expect(H.isSubChar(isA, 4, "bbbbäbbbb")).toStrictEqual(-1);
  });

  test("return -2 when newline", ({ expect }) => {
    expect(H.isSubChar(isA, 0, "\n")).toStrictEqual(-2);
    expect(H.isSubChar(isA, 4, "bbbb\nbbbb")).toStrictEqual(-2);
  });

  test("return +2 on '🙊'", ({ expect }) => {
    expect(H.isSubChar(isA, 0, "🙊")).toStrictEqual(2);
    expect(H.isSubChar(isA, 4, "bbbb🙊bbbb")).toStrictEqual(6);
  });
});

// isCharCode

helpersGroup("isCharCode", () => {
  test("simple valid check", ({ expect }) => {
    expect(H.isCharCode(97, 0, "a")).toBeTruthy();
  });

  test("offset is beyond string", ({ expect }) => {
    expect(H.isCharCode(97, 1, "a")).toBeFalsy();
  });

  test("wrong char code", ({ expect }) => {
    expect(H.isCharCode(97, 0, "b")).toBeFalsy();
  });

  test("find correct char in large string", ({ expect }) => {
    expect(H.isCharCode(98, 7, "aaaaaabaaaaa")).toBeFalsy();
  });
});

// isAlphaNum
helpersGroup("isAlphaNum", () => {
  test("returns true on the empty string", ({ expect }) => {
    expect(H.isAlphaNum("")).toBeTruthy();
  });

  test("returns true a string with all alphaNum characters", ({ expect }) => {
    expect(H.isAlphaNum("abcdefghijklmnopqrstuvxyz")).toBeTruthy();
    expect(H.isAlphaNum("ABCDEFGHIJKLMNOPQRSTUVXYZ")).toBeTruthy();
    expect(H.isAlphaNum("1234567890")).toBeTruthy();
  });

  test("returns false on non alphanum characters", ({ expect }) => {
    expect(H.isAlphaNum("=")).toBeFalsy();
  });

  test("returns false on a mix of alpahanum and non alphanum characters", ({
    expect,
  }) => {
    expect(H.isAlphaNum("as123=asd2")).toBeFalsy();
  });
});

// isDigit

helpersGroup("isDigit", () => {
  test("returns true on the empty string", ({ expect }) => {
    expect(H.isDigit("")).toBeTruthy();
  });

  test("returns true a string with all digits", ({ expect }) => {
    expect(H.isDigit("1234567890")).toBeTruthy();
  });

  test("returns false on non alphanum characters", ({ expect }) => {
    expect(H.isDigit("a")).toBeFalsy();
    expect(H.isDigit("Z")).toBeFalsy();
    expect(H.isDigit("=")).toBeFalsy();
  });

  test("returns false on a mix of alpahanum and non alphanum characters", ({
    expect,
  }) => {
    expect(H.isDigit("123=asd2")).toBeFalsy();
  });
});

// isLower

helpersGroup("isLower", () => {
  test("returns true on the empty string", ({ expect }) => {
    expect(H.isLower("")).toBeTruthy();
  });

  test("returns true a string with all lowercase characters", ({ expect }) => {
    expect(H.isLower("abcdefghijklmnopqrstuvxyz")).toBeTruthy();
  });

  test("returns false on non lowercase characters", ({ expect }) => {
    expect(H.isLower("A")).toBeFalsy();
  });

  test("returns false when there is a single non lowercase character", ({
    expect,
  }) => {
    expect(H.isLower("abcdefghijKlmnopqrstuvxyz")).toBeFalsy();
  });
});

// isUpper

helpersGroup("isUpper", () => {
  test("returns true on the empty string", ({ expect }) => {
    expect(H.isUpper("")).toBeTruthy();
  });

  test("returns true a string with all uppercase characters", ({ expect }) => {
    expect(H.isUpper("ABCDEFGHIJKLMNOPQRSTUVXYZ")).toBeTruthy();
  });

  test("returns false on non uppercase characters", ({ expect }) => {
    expect(H.isUpper("a"));
  });

  test("returns false when there is a single non uppercase character", ({
    expect,
  }) => {
    expect(H.isUpper("ABCDEFGHIJKLmNOPQRSTUVXYZ")).toBeFalsy();
  });
});

// chompBase10

helpersGroup("chompBase10", () => {
  test("chomp nothing on none base 10 characters", ({ expect }) => {
    expect(H.chompBase10(2, "aaaaaaaaaa1928a")).toStrictEqual(2);
  });

  test("chomp on seeing base 10 characters", ({ expect }) => {
    expect(H.chompBase10(10, "aaaaaaaaaa1928a")).toStrictEqual(14);
  });

  test("chomp nothing when offset is out of bounds", ({ expect }) => {
    expect(H.chompBase10(100, "aaaaaaaaaa1928a")).toStrictEqual(100);
  });

  test("chomp nothing when the string is empty", ({ expect }) => {
    expect(H.chompBase10(0, "")).toStrictEqual(0);
  });

  test("chomp until end if necessary", ({ expect }) => {
    expect(H.chompBase10(2, "1111111")).toStrictEqual(7);
  });
});

// consumeBase

helpersGroup("consumeBase", () => {
  test("handles base 8", ({ expect }) => {
    expect(H.consumeBase(8, 0, "0123456789")).toStrictEqual([8, 342391]);
  });

  test("handles base 8 when nothing to consume", ({ expect }) => {
    expect(H.consumeBase(8, 1, "999")).toStrictEqual([1, 0]);
  });
});

// consumeBase16

helpersGroup("consumeBase16", () => {
  test("handles random base 16 number", ({ expect }) => {
    expect(H.consumeBase16(0, "30A93F85")).toStrictEqual([8, 816398213]);
  });

  test("handles all base 16 characters", ({ expect }) => {
    expect(H.consumeBase16(0, "ABCDEF0123456789")).toStrictEqual([
      16, 12379813738877118000,
    ]);
    expect(H.consumeBase16(0, "abcdef0123456789")).toStrictEqual([
      16, 12379813738877118000,
    ]);
  });

  test("will stop on none base 16 characters", ({ expect }) => {
    expect(H.consumeBase16(3, "åäöABCDEF!StopABCDEF")).toStrictEqual([
      9, 11259375,
    ]);
  });
});

// findSubString

helpersGroup("findSubString", () => {
  test("offset is on start of substring", ({ expect }) => {
    expect(H.findSubString("42", 0, 1, 1, "Is 42 the answer?")).toStrictEqual([
      3, 1, 4,
    ]);
  });

  test("offset is on after substring", ({ expect }) => {
    expect(H.findSubString("42", 7, 1, 8, "Is 42 the answer?")).toStrictEqual([
      -1, 1, 18,
    ]);
  });

  test("offset in '🙈🙉🙊'", ({ expect }) => {
    expect(H.findSubString("🙉", 0, 1, 1, "🙈🙉🙊")).toStrictEqual([2, 1, 2]);
  });

  test("offset with newlines", ({ expect }) => {
    expect(H.findSubString("🙉", 0, 1, 1, "🙈\n\n\n1🙊🙉🙊")).toStrictEqual([
      8, 4, 3,
    ]);
  });
});
