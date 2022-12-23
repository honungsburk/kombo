import { test, Group } from "@japa/runner";
import * as P from "./Parser.js";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`Parser.${fnName}`, (group) => {
    group.tap((test) => test.tags(["@unit", "@pure", "@parser", `@${fnName}`]));
    callback(group);
  });
}

group("bagToList", () => {
  test("Empty bag becomes empty list", ({ expect }) => {
    const bag = P.Empty;
    const list = P.bagToList(P.Empty);
    expect(list).toStrictEqual([]);
  });
});
