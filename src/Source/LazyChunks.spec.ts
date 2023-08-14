import { test, Group } from "@japa/runner";
import Stream from "stream";
import PullStream from "./PullStream.js";
import LazeChunks from "./LazyChunks.js";
import * as Assert from "./Assert.js";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`LazyChunks.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@LazyChunks", `@${fnName}`])
    );
    callback(group);
  });
}
group("getChunk", () => {
  test("can fetch a chunk from start", async ({ expect }) => {
    const r = new Stream.PassThrough({
      highWaterMark: undefined,
      encoding: "utf8",
      objectMode: false,
    });
    r.push("Hello, world!");
    r.push(null);
    const lazy = new LazeChunks(new PullStream(r, Assert.isBuffer));

    const res = await lazy.getChunk(0, 1);
    expect(res).toStrictEqual(["Hello, world!", 0]);
  });

  test("can fetch a chunk from offset", async ({ expect }) => {
    const r = new Stream.PassThrough({
      highWaterMark: undefined,
      encoding: "utf8",
      objectMode: false,
    });
    r.push("Hello, world!");
    r.push(null);
    const lazy = new LazeChunks(new PullStream(r, Assert.isBuffer));

    const res = await lazy.getChunk(3, 1);
    expect(res).toStrictEqual(["Hello, world!", 0]);
  });
});
