import { test, Group } from "@japa/runner";
import LazyChunks from "./LazyChunks.js";
import * as NodeStream from "./NodeStream.js";
import * as Assert from "./Assert.js";
import Stream from "stream";
import PullStream from "./PullStream.js";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`NodeStreamSource.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@nodestreamsource", `@${fnName}`])
    );
    callback(group);
  });
}

function fromString(str: string): LazyChunks {
  // const w = new Stream.Writable();
  // w.write("hello");
  // TODO: We need to simulate more complex stream behavior
  const r = new Stream.PassThrough({
    highWaterMark: undefined,
    encoding: "utf8",
    objectMode: false,
  });
  r.push(str);
  r.push(null);
  const pullStream = new PullStream(r, Assert.isBuffer);
  return new LazyChunks(pullStream);
}

// isSubChunk

group("isSubChunk", () => {
  test("empty string in empty string", async ({ expect }) => {
    const src = fromString(" ");
    expect(await NodeStream.isSubChunk("", 0, 1, 1, src)).toStrictEqual([
      0, 1, 1,
    ]);
  });

  test("correct in a simple array", async ({ expect }) => {
    const src = fromString("let x = 4 in x");
    expect(await NodeStream.isSubChunk("let", 0, 1, 1, src)).toStrictEqual([
      3, 1, 4,
    ]);
  });

  test("incorrect in a simple array", async ({ expect }) => {
    const src = fromString("let x = 4 in x");
    expect(await NodeStream.isSubChunk("let", 1, 1, 2, src)).toStrictEqual([
      -1, 1, 2,
    ]);
  });

  test("malformed input", async ({ expect }) => {
    const src = fromString("lee x = 4 in x");
    expect(await NodeStream.isSubChunk("let", 0, 1, 1, src)).toStrictEqual([
      -1, 1, 3,
    ]);
  });
});

// isSubToken

const isA = (c: string) => c === "a" || c === "\n" || c === "🙊";

group("isSubToken", () => {
  test("check that a char is an 'a' and increment the offset", async ({
    expect,
  }) => {
    const src1 = fromString("a");
    expect(await NodeStream.isSubToken(isA, 0, src1)).toStrictEqual(1);
    const src2 = fromString("bbbbabbbb");
    expect(await NodeStream.isSubToken(isA, 4, src2)).toStrictEqual(5);
  });

  test("return -1 when not an 'a'", async ({ expect }) => {
    const src1 = fromString("ä");
    expect(await NodeStream.isSubToken(isA, 0, src1)).toStrictEqual(-1);
    const src2 = fromString("bbbbäbbbb");
    expect(await NodeStream.isSubToken(isA, 4, src2)).toStrictEqual(-1);
  });

  test("return -2 when newline", async ({ expect }) => {
    const src1 = fromString("\n");
    expect(await NodeStream.isSubToken(isA, 0, src1)).toStrictEqual(-2);
    const src2 = fromString("bbbb\nbbbb");
    expect(await NodeStream.isSubToken(isA, 4, src2)).toStrictEqual(-2);
  });

  test("return +2 on '🙊'", async ({ expect }) => {
    const src1 = fromString("🙊");
    expect(await NodeStream.isSubToken(isA, 0, src1)).toStrictEqual(2);
    const src2 = fromString("bbbb🙊bbbb");
    expect(await NodeStream.isSubToken(isA, 4, src2)).toStrictEqual(6);
  });
});

// findSubChunk

group("findSubChunk", () => {
  test("substring was found", async ({ expect }) => {
    const src = fromString("Is 42 the answer?");
    expect(await NodeStream.findSubChunk("42", 0, 1, 1, src)).toStrictEqual([
      true,
      3,
      1,
      4,
    ]);
  });

  test("substring was not found", async ({ expect }) => {
    const src = fromString("Is 42 the answer?");
    expect(await NodeStream.findSubChunk("42", 7, 1, 8, src)).toStrictEqual([
      false,
      17,
      1,
      18,
    ]);
  });

  test("offset in '🙈🙉🙊'", async ({ expect }) => {
    const src = fromString("🙈🙉🙊");
    expect(await NodeStream.findSubChunk("🙉", 0, 1, 1, src)).toStrictEqual([
      true,
      2,
      1,
      2,
    ]);
  });

  test("offset with newlines", async ({ expect }) => {
    const src = fromString("🙈\n\n\n1🙊🙉🙊");
    expect(await NodeStream.findSubChunk("🙉", 0, 1, 1, src)).toStrictEqual([
      true,
      8,
      4,
      3,
    ]);
  });
});
