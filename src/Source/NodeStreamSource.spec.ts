import { test, Group } from "@japa/runner";
import NodeStreamSource from "./NodeStreamSource.js";
import Stream from "stream";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`NodeStreamSource.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@nodestreamsource", `@${fnName}`])
    );
    callback(group);
  });
}

function fromString(str: string): NodeStreamSource {
  // const w = new Stream.Writable();
  // w.write("hello");

  // TODO: We need to simulate more complex stream behavior

  const r = new Stream.Readable({
    highWaterMark: undefined,
    encoding: "utf8",
    objectMode: false,
  });
  r.push(str);
  return new NodeStreamSource(r);
}

// isSubChunk

group("isSubChunk", () => {
  test("empty string in empty string", ({ expect }) => {
    const src = fromString("");
    expect(src.isSubChunk("", 0, 1, 1)).toStrictEqual([0, 1, 1]);
  });

  test("correct in a simple array", ({ expect }) => {
    const src = fromString("let x = 4 in x");
    expect(src.isSubChunk("let", 0, 1, 1)).toStrictEqual([3, 1, 4]);
  });

  test("incorrect in a simple array", ({ expect }) => {
    const src = fromString("let x = 4 in x");
    expect(src.isSubChunk("let", 1, 1, 2)).toStrictEqual([-1, 1, 2]);
  });

  test("malformed input", ({ expect }) => {
    const src = fromString("lee x = 4 in x");
    expect(src.isSubChunk("let", 0, 1, 1)).toStrictEqual([-1, 1, 3]);
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

  test("return -2 when newline", ({ expect }) => {
    expect(fromString("\n").isSubToken(isA, 0)).toStrictEqual(-2);
    expect(fromString("bbbb\nbbbb").isSubToken(isA, 4)).toStrictEqual(-2);
  });

  test("return +2 on '🙊'", ({ expect }) => {
    expect(fromString("🙊").isSubToken(isA, 0)).toStrictEqual(2);
    expect(fromString("bbbb🙊bbbb").isSubToken(isA, 4)).toStrictEqual(6);
  });
});

// findSubChunk

group("findSubChunk", () => {
  test("substring was found", ({ expect }) => {
    const src = fromString("Is 42 the answer?");
    expect(src.findSubChunk("42", 0, 1, 1)).toStrictEqual([3, 1, 4]);
  });

  test("substring was not found", ({ expect }) => {
    const src = fromString("Is 42 the answer?");
    expect(src.findSubChunk("42", 7, 1, 8)).toStrictEqual([-1, 1, 18]);
  });

  test("offset in '🙈🙉🙊'", ({ expect }) => {
    const src = fromString("🙈🙉🙊");
    expect(src.findSubChunk("🙉", 0, 1, 1)).toStrictEqual([2, 1, 2]);
  });

  test("offset with newlines", ({ expect }) => {
    const src = fromString("🙈\n\n\n1🙊🙉🙊");
    expect(src.findSubChunk("🙉", 0, 1, 1)).toStrictEqual([8, 4, 3]);
  });
});
