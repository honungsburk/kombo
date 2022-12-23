import { test, Group } from "@japa/runner";
import Immutable from "immutable";
import * as P from "./Parser.js";

function group(fnName: string, callback: (group: Group) => void) {
  test.group(`Parser.${fnName}`, (group) => {
    group.tap((test) => test.tags(["@unit", "@pure", "@parser", `@${fnName}`]));
    callback(group);
  });
}

group("bagToList", () => {
  test("Empty bag yields empty list", ({ expect }) => {
    const bag = P.Empty;
    const list = P.bagToList(bag);
    expect(list).toStrictEqual([]);
  });

  test("Appending two empty bags yields empty list", ({ expect }) => {
    const bag = P.Append(P.Empty, P.Empty);
    const list = P.bagToList(bag);
    expect(list).toStrictEqual([]);
  });

  test("Appending empty and right yields empty list", ({ expect }) => {
    const deadEnd1 = P.Deadend(
      1,
      1,
      "A Problem",
      Immutable.Stack<P.Located<unknown>>()
    );
    const bag = P.Append(P.Empty, P.AddRight(P.Empty, deadEnd1));
    const list = P.bagToList(bag);
    expect(list).toStrictEqual([deadEnd1]);
  });
});
