import { test, Group } from "@japa/runner";
import NodeStreamSource from "./NodeStreamSource.js";
import Stream from "stream";
import PullStream from "./PullStream.js";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`NodeStreamSource.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@PullStream", `@${fnName}`])
    );
    callback(group);
  });
}

group("pull", () => {
  test("pulls from a stream", async ({ expect }) => {
    const r = new Stream.Readable({
      highWaterMark: undefined,
      encoding: "utf8",
      objectMode: false,
    });
    r.push("hello");
    r.push("world");
    r.push(null);
    const src = new PullStream(r, (x) => typeof x === "string");
    expect(await src.pull()).toStrictEqual("hello");
    expect(await src.pull()).toStrictEqual("world");
    expect(await src.pull()).toStrictEqual(null);
  });
});
