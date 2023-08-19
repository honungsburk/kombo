import { test, Group } from "@japa/runner";
import * as string from "./String.js";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`StringSource.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@stringsource", `@${fnName}`])
    );
    callback(group);
  });
}

// isSubChunk

group("isSubChunk", () => {
  test("empty string in empty string", ({ expect }) => {
    expect(string.core.isSubChunk("", 0, 1, 1, "")).toStrictEqual([0, 1, 1]);
  });

  test("correct in a simple string", ({ expect }) => {
    expect(
      string.core.isSubChunk("let", 0, 1, 1, "let x = 4 in x")
    ).toStrictEqual([3, 1, 4]);
  });

  test("incorrect in a simple string", ({ expect }) => {
    expect(
      string.core.isSubChunk("let", 1, 1, 2, "let x = 4 in x")
    ).toStrictEqual([-1, 1, 2]);
  });

  test("malformed input", ({ expect }) => {
    expect(
      string.core.isSubChunk("let", 0, 1, 1, "lee x = 4 in x")
    ).toStrictEqual([-1, 1, 3]);
  });

  test("handles newlines", ({ expect }) => {
    expect(
      string.core.isSubChunk(
        "Hello,\nworld!",
        6,
        1,
        7,
        "What?\nHello,\nworld!\nOkey?!"
      )
    ).toStrictEqual([19, 2, 7]);
  });
});

// isSubToken

const isA = (c: string) => c === "a" || c === "\n" || c === "🙊";

group("isSubToken", () => {
  test("check that a char is an 'a' and increment the offset", ({ expect }) => {
    expect(string.core.isSubToken(isA, 0, "a")).toStrictEqual(1);
    expect(string.core.isSubToken(isA, 4, "bbbbabbbb")).toStrictEqual(5);
  });

  test("return -1 when not an 'a'", ({ expect }) => {
    expect(string.core.isSubToken(isA, 0, "ä")).toStrictEqual(-1);
    expect(string.core.isSubToken(isA, 4, "bbbbäbbbb")).toStrictEqual(-1);
  });

  test("return -2 when newline", ({ expect }) => {
    expect(string.core.isSubToken(isA, 0, "\n")).toStrictEqual(-2);
    expect(string.core.isSubToken(isA, 4, "bbbb\nbbbb")).toStrictEqual(-2);
  });

  test("return +2 on '🙊'", ({ expect }) => {
    expect(string.core.isSubToken(isA, 0, "🙊")).toStrictEqual(2);
    expect(string.core.isSubToken(isA, 4, "bbbb🙊bbbb")).toStrictEqual(6);
  });
});

// findSubChunk

group("findSubChunk", () => {
  test("substring was found", ({ expect }) => {
    expect(
      string.core.findSubChunk("42", 0, 1, 1, "Is 42 the answer?")
    ).toStrictEqual([true, 3, 1, 4]);
  });

  test("substring was not found", ({ expect }) => {
    expect(
      string.core.findSubChunk("42", 7, 1, 8, "Is 42 the answer?")
    ).toStrictEqual([false, 17, 1, 18]);
  });

  test("offset in '🙈🙉🙊'", ({ expect }) => {
    expect(string.core.findSubChunk("🙉", 0, 1, 1, "🙈🙉🙊")).toStrictEqual([
      true,
      2,
      1,
      2,
    ]);
  });

  test("offset with newlines", ({ expect }) => {
    expect(
      string.core.findSubChunk("🙉", 0, 1, 1, "🙈\n\n\n1🙊🙉🙊")
    ).toStrictEqual([true, 8, 4, 3]);
  });
});
