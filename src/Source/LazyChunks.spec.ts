import { test, Group } from "@japa/runner";
import Stream from "stream";
import PullStream from "./PullStream.js";
import LazeChunks from "./LazyChunks.js";
import * as Assert from "./Assert.js";

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`LazyChunks.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@LazyChunks", `@${fnName}`])
    );
    callback(group);
  });
}

function createStream(): Stream.PassThrough {
  return new Stream.PassThrough({
    highWaterMark: undefined,
    encoding: "utf8",
    objectMode: false,
  });
}

function createLazyChunks(stream: Stream.PassThrough): LazeChunks {
  return new LazeChunks(new PullStream(stream, Assert.isBuffer));
}

////////////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////////////

group("getChunk", () => {
  test("can fetch a chunk from start", async ({ expect }) => {
    const r = createStream();
    r.push("Hello, world!");
    r.push(null);
    const lazy = createLazyChunks(r);

    const res = await lazy.getChunk(0, 1);
    expect(res).toStrictEqual(["Hello, world!", 0]);
  });

  test("can fetch a chunk from offset", async ({ expect }) => {
    const r = createStream();
    r.push("Hello, world!");
    r.push(null);
    const lazy = createLazyChunks(r);

    const res = await lazy.getChunk(3, 1);
    expect(res).toStrictEqual(["Hello, world!", 0]);
  });
  test("can fetch when there are multiple chunks", async ({ expect }) => {
    const r = createStream();
    const lazy = createLazyChunks(r);
    let res = await lazy.getChunk(0, 1);
    let a = "aaaaaaaaaaa";
    let b = "bbbbbbbbbbb";
    let c = "ccccccccccc";

    r.push(a);
    expect(res).toStrictEqual([a, 0]);
    r.push(b);

    res = await lazy.getChunk(a.length + 1, 1);
    expect(res).toStrictEqual([a + b, 0]);
    r.push(c);
    r.push(null);
    res = await lazy.getChunk(a.length + b.length + 1, 1);
    expect(res).toStrictEqual([b + c, a.length]);
  }).pin();
});
