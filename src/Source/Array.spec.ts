import { test, Group } from "@japa/runner";
import * as Array from "./Array.js";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`ArraySource.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@arraysource", `@${fnName}`])
    );
    callback(group);
  });
}

function fromString(str: string) {
  return str.split("");
}

const stringSrc = Array.core((a: string, b: string) => a === b);

// isSubChunk

group("isSubChunk", () => {
  test("empty string in empty string", ({ expect }) => {
    expect(stringSrc.isSubChunk([], 0, 1, 1, [])).toStrictEqual([0, 1, 1]);
  });

  test("correct in a simple array", ({ expect }) => {
    const src = "let x = 4 in x".split("");
    expect(stringSrc.isSubChunk("let".split(""), 0, 1, 1, src)).toStrictEqual([
      3, 1, 4,
    ]);
  });

  test("incorrect in a simple array", ({ expect }) => {
    const src = "let x = 4 in x".split("");
    expect(stringSrc.isSubChunk("let".split(""), 1, 1, 2, src)).toStrictEqual([
      -1, 1, 2,
    ]);
  });

  test("malformed input", ({ expect }) => {
    const src = "lee x = 4 in x".split("");
    expect(stringSrc.isSubChunk("let".split(""), 0, 1, 1, src)).toStrictEqual([
      -1, 1, 3,
    ]);
  });
});

// isSubToken

const isA = (c: string) => c === "a" || c === "\n" || c === "🙊";

group("isSubToken", () => {
  test("check that a token is an 'a' and increment the offset", ({
    expect,
  }) => {
    expect(stringSrc.isSubToken(isA, 0, ["a"])).toStrictEqual(1);
    expect(stringSrc.isSubToken(isA, 4, "bbbbabbbb".split(""))).toStrictEqual(
      5
    );
  });

  test("return -1 when not an 'a'", ({ expect }) => {
    expect(stringSrc.isSubToken(isA, 0, ["ä"])).toStrictEqual(-1);
    expect(stringSrc.isSubToken(isA, 4, "bbbbäbbbb".split(""))).toStrictEqual(
      -1
    );
  });

  test("no special behavior on newlines", ({ expect }) => {
    expect(stringSrc.isSubToken(isA, 0, ["\n"])).toStrictEqual(1);
    expect(
      stringSrc.isSubToken(isA, 4, fromString("bbbb\nbbbb"))
    ).toStrictEqual(5);
  });

  test("return +1 on '🙊'", ({ expect }) => {
    expect(stringSrc.isSubToken(isA, 0, ["🙊"])).toStrictEqual(1);
    expect(
      stringSrc.isSubToken(isA, 4, [
        "b",
        "b",
        "b",
        "b",
        "🙊",
        "b",
        "b",
        "b",
        "b",
      ])
    ).toStrictEqual(5);
  });
});

// findSubChunk

group("findSubChunk", () => {
  test("subchunk was found", ({ expect }) => {
    const src = fromString("Is 42 the answer?");
    expect(stringSrc.findSubChunk("42".split(""), 0, 1, 1, src)).toStrictEqual([
      true,
      3,
      1,
      4,
    ]);
  });

  test("subchunk not found", ({ expect }) => {
    const src = fromString("Is 42 the answer?");
    expect(stringSrc.findSubChunk("42".split(""), 7, 1, 8, src)).toStrictEqual([
      true,
      17,
      1,
      18,
    ]);
  });

  test("offset in '['🙈','🙉','🙊']", ({ expect }) => {
    const src = ["🙈", "🙉", "🙊"];
    expect(stringSrc.findSubChunk(["🙉"], 0, 1, 1, src)).toStrictEqual([
      true,
      1,
      1,
      2,
    ]);
  });

  test("offset with newlines", ({ expect }) => {
    const src = ["🙈", "\n", "\n", "\n", "1", "🙊", "🙉", "🙊"];
    expect(stringSrc.findSubChunk(["🙉"], 0, 1, 1, src)).toStrictEqual([
      true,
      6,
      1,
      7,
    ]);
  });

  test("can find subChunk at the end", ({ expect }) => {
    const src = fromString("abcdefghijklmnopqrstuvxyz");
    expect(stringSrc.findSubChunk(["x", "y", "z"], 0, 1, 1, src)).toStrictEqual(
      [true, 22, 1, 23]
    );
  });
});
