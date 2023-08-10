import { test, Group } from "@japa/runner";
import StringSource from "./StringSource.js";

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
    const src = new StringSource("");
    expect(src.isSubChunk("", 0, 1, 1)).toStrictEqual([0, 1, 1]);
  });

  test("correct in a simple string", ({ expect }) => {
    const src = new StringSource("let x = 4 in x");
    expect(src.isSubChunk("let", 0, 1, 1)).toStrictEqual([3, 1, 4]);
  });

  test("incorrect in a simple string", ({ expect }) => {
    const src = new StringSource("let x = 4 in x");
    expect(src.isSubChunk("let", 1, 1, 2)).toStrictEqual([-1, 1, 2]);
  });

  test("malformed input", ({ expect }) => {
    const src = new StringSource("lee x = 4 in x");
    expect(src.isSubChunk("let", 0, 1, 1)).toStrictEqual([-1, 1, 3]);
  });

  test("handles newlines", ({ expect }) => {
    const src = new StringSource("What?\nHello,\nworld!\nOkey?!");
    expect(src.isSubChunk("Hello,\nworld!", 6, 1, 7)).toStrictEqual([19, 2, 7]);
  });
});

// isSubToken

const isA = (c: string) => c === "a" || c === "\n" || c === "🙊";

group("isSubToken", () => {
  test("check that a char is an 'a' and increment the offset", ({ expect }) => {
    expect(new StringSource("a").isSubToken(isA, 0)).toStrictEqual(1);
    expect(new StringSource("bbbbabbbb").isSubToken(isA, 4)).toStrictEqual(5);
  });

  test("return -1 when not an 'a'", ({ expect }) => {
    expect(new StringSource("ä").isSubToken(isA, 0)).toStrictEqual(-1);
    expect(new StringSource("bbbbäbbbb").isSubToken(isA, 4)).toStrictEqual(-1);
  });

  test("return -2 when newline", ({ expect }) => {
    expect(new StringSource("\n").isSubToken(isA, 0)).toStrictEqual(-2);
    expect(new StringSource("bbbb\nbbbb").isSubToken(isA, 4)).toStrictEqual(-2);
  });

  test("return +2 on '🙊'", ({ expect }) => {
    expect(new StringSource("🙊").isSubToken(isA, 0)).toStrictEqual(2);
    expect(new StringSource("bbbb🙊bbbb").isSubToken(isA, 4)).toStrictEqual(6);
  });
});

// findSubChunk

group("findSubChunk", () => {
  test("offset is on start of substring", ({ expect }) => {
    const src = new StringSource("Is 42 the answer?");
    expect(src.findSubChunk("42", 0, 1, 1)).toStrictEqual([3, 1, 4]);
  });

  test("offset is on after substring", ({ expect }) => {
    const src = new StringSource("Is 42 the answer?");
    expect(src.findSubChunk("42", 7, 1, 8)).toStrictEqual([-1, 1, 18]);
  });

  test("offset in '🙈🙉🙊'", ({ expect }) => {
    const src = new StringSource("🙈🙉🙊");
    expect(src.findSubChunk("🙉", 0, 1, 1)).toStrictEqual([2, 1, 2]);
  });

  test("offset with newlines", ({ expect }) => {
    const src = new StringSource("🙈\n\n\n1🙊🙉🙊");
    expect(src.findSubChunk("🙉", 0, 1, 1)).toStrictEqual([8, 4, 3]);
  });
});
