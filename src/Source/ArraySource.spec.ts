import { test, Group } from "@japa/runner";
import ArraySource from "./ArraySource.js";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`ArraySource.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@arraysource", `@${fnName}`])
    );
    callback(group);
  });
}

function fromString(str: string): ArraySource<string> {
  return new ArraySource(str.split(""), (x, y) => x === y);
}

function fromStrings(...strings: string[]): ArraySource<string> {
  return new ArraySource(strings, (x, y) => x === y);
}

// isSubChunk

group("isSubChunk", () => {
  test("empty string in empty string", ({ expect }) => {
    const src = fromStrings();
    expect(src.isSubChunk([], 0, 1, 1)).toStrictEqual([0, 1, 1]);
  });

  test("correct in a simple array", ({ expect }) => {
    const src = fromString("let x = 4 in x");
    expect(src.isSubChunk("let".split(""), 0, 1, 1)).toStrictEqual([3, 1, 4]);
  });

  test("incorrect in a simple array", ({ expect }) => {
    const src = fromString("let x = 4 in x");
    expect(src.isSubChunk("let".split(""), 1, 1, 2)).toStrictEqual([-1, 1, 2]);
  }).pin();

  test("malformed input", ({ expect }) => {
    const src = fromString("lee x = 4 in x");
    expect(src.isSubChunk("let".split(""), 0, 1, 1)).toStrictEqual([-1, 1, 3]);
  });
});
// isSubToken

const isA = (c: string) => c === "a" || c === "\n" || c === "🙊";

group("isSubToken", () => {
  test("check that a char is an 'a' and increment the offset", ({ expect }) => {
    expect(fromString("a").isSubToken(isA, 0)).toStrictEqual(1);
    expect(fromString("bbbbabbbb").isSubToken(isA, 4)).toStrictEqual(5);
  });

  test("return -1 when not an 'a'", ({ expect }) => {
    expect(fromString("ä").isSubToken(isA, 0)).toStrictEqual(-1);
    expect(fromString("bbbbäbbbb").isSubToken(isA, 4)).toStrictEqual(-1);
  });

  test("return -1 when newline", ({ expect }) => {
    expect(fromString("\n").isSubToken(isA, 0)).toStrictEqual(-1);
    expect(fromString("bbbb\nbbbb").isSubToken(isA, 4)).toStrictEqual(-1);
  });

  test("return +1 on '🙊'", ({ expect }) => {
    expect(fromStrings("🙊").isSubToken(isA, 0)).toStrictEqual(1);
    expect(
      fromStrings("b", "b", "b", "b", "🙊", "b", "b", "b", "b").isSubToken(
        isA,
        4
      )
    ).toStrictEqual(5);
  });
});

// findSubChunk

group("findSubChunk", () => {
  test("offset is on start of substring", ({ expect }) => {
    const src = fromString("Is 42 the answer?");
    expect(src.findSubChunk("42".split(""), 0, 1, 1)).toStrictEqual([3, 1, 4]);
  });

  test("offset is on after substring", ({ expect }) => {
    const src = fromString("Is 42 the answer?");
    expect(src.findSubChunk("42".split(""), 7, 1, 8)).toStrictEqual([
      -1, 1, 18,
    ]);
  });

  test("offset in '🙈🙉🙊'", ({ expect }) => {
    const src = fromStrings("🙈", "🙉", "🙊");
    expect(src.findSubChunk(["🙉"], 0, 1, 1)).toStrictEqual([2, 1, 2]);
  });

  test("offset with newlines", ({ expect }) => {
    const src = fromStrings("🙈", "\n", "\n", "\n", "1", "🙊", "🙉", "🙊");
    expect(src.findSubChunk(["🙉"], 0, 1, 1)).toStrictEqual([7, 1, 8]);
  });
});
