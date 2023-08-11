import { test, Group } from "@japa/runner";
import NodeStreamSource from "./NodeStreamSource.js";
import Stream from "stream";
import PullStream from "./PullStream.js";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`PullStream.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@PullStream", `@${fnName}`])
    );
    callback(group);
  });
}

function assertIsString(x: any): asserts x is string {
  if (typeof x !== "string") {
    throw new Error("Expected string");
  }
}

function assertIsBuffer(x: any): asserts x is Buffer {
  if (!(x instanceof Buffer)) {
    throw new Error("Expected a buffer");
  }
}

group("pull", () => {
  test("pull once from a stream", async ({ expect }) => {
    const r = new Stream.PassThrough({
      highWaterMark: undefined,
      encoding: "utf8",
      objectMode: false,
    });
    r.push("hello");
    r.push(null);
    const src = new PullStream(r, assertIsBuffer);
    const pullS = () =>
      src.pull().then((res) => (res === null ? null : res.toString("utf-8")));
    expect(await pullS()).toStrictEqual("hello");
    expect(await pullS()).toStrictEqual(null);
  });

  test("pull multiple times from a stream", async ({ expect }) => {
    const r = new Stream.PassThrough({
      highWaterMark: undefined,
      encoding: "utf8",
      objectMode: false,
    });
    const src = new PullStream(r, assertIsBuffer);
    const pullS = () =>
      src.pull().then((res) => (res === null ? null : res.toString("utf-8")));

    r.push("hello");
    expect(await pullS()).toStrictEqual("hello");

    r.push("world");
    expect(await pullS()).toStrictEqual("world");

    r.push(null);
    expect(await pullS()).toStrictEqual(null);
  });

  test("no space leak", async ({ expect }) => {
    const r = new Stream.PassThrough({
      highWaterMark: undefined,
      encoding: "utf8",
      objectMode: false,
    });
    const src = new PullStream(r, assertIsBuffer);
    const pullS = () =>
      src.pull().then((res) => (res === null ? null : res.toString("utf-8")));

    for (let i = 0; i < 100; i++) {
      r.push("b");
      expect(await pullS()).toStrictEqual("b");
    }

    expect(src._hasSpaceLeak()).toBeFalsy();

    r.push(null);
    expect(await pullS()).toStrictEqual(null);
  });
});
