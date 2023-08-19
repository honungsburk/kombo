import { Expect } from "@japa/expect";
import { test, Group } from "@japa/runner";
import * as Results from "./Result.js";
import * as AA from "./Advanced.js";
import * as P from "./Parser.js";
import * as Helpers from "./Helpers.js";
import Immutable from "immutable";
import { StringCore, core } from "./Source/String.js";

const A = { ...AA.create(core), ...AA.string(core) };

// Helpers

function advancedGroup(fnName: string, callback: (group: Group) => void) {
  test.group(`Advanced.${fnName}`, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@advanced", `@${fnName}`])
    );
    callback(group);
  });
}

function expectProblem<A, CTX>(
  expect: Expect,
  result: Results.Result<any, P.DeadEnd<CTX, A>[]>,
  toBe: A[]
): void {
  expect(Results.isErr(result)).toBeTruthy();
  if (result.isErr) {
    expect(result.value.map((d) => d.problem)).toStrictEqual(toBe);
  }
}

const testSuccessBuilder =
  <A>(parser: P.Parser<StringCore, A, any, any>) =>
  (description: string, input: string, expected: A) => {
    return test(description, async ({ expect }) => {
      const result = await parser.run(input);
      expect(result.value).toStrictEqual(expected);
    });
  };

const testFailureBuilder =
  <A>(parser: P.Parser<StringCore, any, any, A>) =>
  (description: string, input: string, toBe: A[]) => {
    return test(description, async ({ expect }) => {
      const result = await parser.run(input);
      expectProblem(expect, result, toBe);
    });
  };

// succeed

const succeedOkTest = testSuccessBuilder(A.succeed(1));

advancedGroup("succeed", () => {
  succeedOkTest("always succeeds", "a", 1);
  // test("always succeeds", async ({ expect }) => {
  //   expect(A.run(A.succeed(1))("a")).toStrictEqual(Results.Ok(1));
  // });
});

// problem

const problemErrTest = testFailureBuilder(A.problem("Problem"));

advancedGroup("problem", () => {
  problemErrTest("always fails", "a", ["Problem"]);

  // test("always fails", async ({ expect }) => {
  //   expectProblem(expect, A.run(A.problem("Problem"))("a"), ["Problem"]);
  //   // expect(Results.isErr(A.run(A.problem(1))("a"))).toStrictEqual(true);
  // });
});

// map

const mapSuccessTest = testSuccessBuilder(
  A.map((n: number) => n + 1)(A.succeed(1))
);

advancedGroup("map", () => {
  const p = A.map((n: number) => n + 1)(A.succeed(1));
  testSuccessBuilder(p)("can map values", "a", 2);
});

// map2
advancedGroup("map2", () => {
  test("can map values", async ({ expect }) => {
    const always1 = A.succeed(1);
    const always2 = A.succeed(2);
    const added3 = A.map2((n1: number, n2: number) => n1 + n2)(always1)(
      always2
    );
    const res = await A.run(added3)("a");
    expect(res.value).toStrictEqual(3);
  });

  test("first parser has problem", async ({ expect }) => {
    const problem1 = A.problem("Problem");
    const always2 = A.succeed(2);
    const added1 = A.map2((n1: number, n2: number) => n1 + n2)(problem1)(
      always2
    );
    const res = await A.run(added1)("a");
    expect(Results.isErr(res)).toStrictEqual(true);
  });

  test("second parser has problem", async ({ expect }) => {
    const problem1 = A.problem("Problem");
    const always2 = A.succeed(2);
    const added1 = A.map2((n1: number, n2: number) => n1 + n2)(always2)(
      problem1
    );
    const res = await A.run(added1)("a");
    expect(Results.isErr(res)).toStrictEqual(true);
  });
});

// skip2nd
advancedGroup("skip2nd", () => {
  test("If the 1st parser fails, it fails.", async ({ expect }) => {
    const string = A.problem("Problem");
    const number = A.succeed(2);
    const res = await A.skip2nd(string)(number).run("a");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("If the 2nd parser fails, it fails.", async ({ expect }) => {
    const string = A.problem("Problem");
    const number = A.succeed(2);
    const res = await A.skip2nd(number)(string).run("a");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("Skips the value of the second parser", async ({ expect }) => {
    const string = A.succeed("Take Me");
    const number = A.succeed(2);
    const res = await A.skip2nd(string)(number).run("a");
    expect(res.value).toStrictEqual("Take Me");
  });
});

// keep
advancedGroup("keep", () => {
  test("Applies the value of the second parser to the function of the first", async ({
    expect,
  }) => {
    const add = A.succeed((n: number) => n + 1);
    const number = A.succeed(2);
    const res = await A.apply(add)(number).run("a");
    expect(res.value).toStrictEqual(3);
  });

  test("The first parser has a problem", async ({ expect }) => {
    const add = A.problem("problem1");
    const number = A.succeed(2);
    const res = await A.apply(add)(number).run("a");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("The second parser has a problem", async ({ expect }) => {
    const add = A.succeed((n: number) => n + 1);
    const number = A.problem("problem2");
    const res = await A.apply(add)(number).run("a");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

// andThen
advancedGroup("andThen", () => {
  test("When both succeed it composes everything nicely", async ({
    expect,
  }) => {
    const number = A.succeed(2);
    const toString = (n: number) => {
      if (n > 2) {
        return A.succeed("larger then 2");
      } else {
        return A.succeed("2 or smaller");
      }
    };
    const res = await A.andThen(toString)(number).run("a");
    expect(res.value).toStrictEqual("2 or smaller");
  });

  test("fail when there is a problem", async ({ expect }) => {
    const number = A.problem("Problem");
    const toString = (n: number) => {
      if (n > 2) {
        return A.succeed("larger then 2");
      } else {
        return A.succeed("2 or smaller");
      }
    };
    const res = await A.andThen(toString)(number).run("a");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("fail when a problem is returned", async ({ expect }) => {
    const number = A.succeed(2);
    const toString = (n: number) => {
      if (n > 2) {
        return A.succeed("larger then 2");
      } else {
        return A.problem("Problem");
      }
    };
    const res = await A.andThen(toString)(number).run("a");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

// oneOf

advancedGroup("oneOf", () => {
  test("Given one parser that succeeds, it succeeds", async ({ expect }) => {
    const success1 = A.succeed(1);

    const p = A.oneOf(success1);
    const res = await A.run(p)("a");
    expect(res.value).toStrictEqual(1);
  });

  test("Given one parser that fails, it fails", async ({ expect }) => {
    const problem1 = A.problem("problem1");

    const p = A.oneOf(problem1);
    const res = await A.run(p)("a");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("Given two parser that succeeds, it takes the first one", async ({
    expect,
  }) => {
    const success1 = A.succeed(1);
    const success2 = A.succeed(2);

    const p = A.oneOf(success1, success2);
    const res = await A.run(p)("a");
    expect(res.value).toStrictEqual(1);
  });

  test("Given one parser that fails, and one that succeeds it will succeed", async ({
    expect,
  }) => {
    const success1 = A.succeed(1);
    const problem1 = A.problem("problem1");

    const p = A.oneOf(problem1, success1);
    const res = await A.run(p)("a");
    expect(res.value).toStrictEqual(1);
  });

  test("If given multiple parsers it takes the first one that succeeds", async ({
    expect,
  }) => {
    const success1 = A.succeed(1);
    const success2 = A.succeed(2);
    const problem1 = A.problem("problem1");
    const problem2 = A.problem("problem1");

    const p = A.oneOf(problem1, problem2, success1, success2);
    const res = await A.run(p)("a");
    expect(res.value).toStrictEqual(1);
  });
});

// Loop

const append = <A>(as: A[], a: A): A[] => {
  as.push(a);
  return as;
};

A.succeed((_c: P.Unit) => A.Loop(append([], "c"))).apply(
  A.token(A.Token("c", "Expected a 'c'"))
);

// Mutating the list... okay in this implementation but bad practice in general
const cCharsHelper = (chars: string[]) =>
  A.oneOf(
    A.succeed((_c: any) => A.Loop(append(chars, "c"))).apply(
      A.token(A.Token("c", "Expected a 'c'"))
    ),
    A.succeed(A.Done(chars))
  );

const cChars = () => A.loop([] as string[])(cCharsHelper);

advancedGroup("loop", () => {
  test("Parse a list of C:s like 'ccccc'", async ({ expect }) => {
    const res = await cChars().run("ccccc");
    expect(res.value).toStrictEqual(["c", "c", "c", "c", "c"]);
  });

  test("can detect non 'c' chars", async ({ expect }) => {
    const res = await cChars().run("ccbcc");
    expect(res.value).toStrictEqual(["c", "c"]);
  });

  test("can handle empty string 'c' chars", async ({ expect }) => {
    // TODO: Test is incorrect, no empty string
    const res = await cChars().run("ccbcc");
    expect(res.value).toStrictEqual(["c", "c"]);
  });
});

// BACKTRACKABLE

enum BacktrackableProblem {
  Comma = "Comma",
  LeftSquareBracket = "LeftSquareBracket",
  Int = "Int",
}

const backtrackExample = A.oneOf(
  A.succeed((x: number) => x)
    .skip(A.backtrackable(A.spaces))
    .skip(A.token(A.Token(",", BacktrackableProblem.Comma)))
    .skip(A.spaces)
    .apply(A.int(BacktrackableProblem.Int)(BacktrackableProblem.Int)),
  A.succeed(undefined)
    .skip(A.spaces)
    .skip(A.token(A.Token("]", BacktrackableProblem.LeftSquareBracket)))
);

advancedGroup("backtrackable", () => {
  test("succeed", async ({ expect }) => {
    const res = await A.run(backtrackExample)("  , 4");
    expect(Results.isOk(res));
    if (Results.isOk(res)) {
      expect(res.value).toStrictEqual(4);
    }
  });

  test("fail", async ({ expect }) => {
    const res = await A.run(backtrackExample)("  ,");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("can not go back", async ({ expect }) => {
    const res = await A.run(backtrackExample)("  , a");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("can go back", async ({ expect }) => {
    const res = await A.run(backtrackExample)("  ]");
    expect(Results.isOk(res));
    if (Results.isOk(res)) {
      expect(res.value).toStrictEqual(undefined);
    }
  });

  test("can not go back again", async ({ expect }) => {
    const res = await A.run(backtrackExample)("  a");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("fail on first char", async ({ expect }) => {
    const res = await A.run(backtrackExample)("abc");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

// TOKEN

const comma = A.token(A.Token(",", "ExpectingComma"));
advancedGroup("token", () => {
  test("fail on other token", async ({ expect }) => {
    const res = await comma.run("abc");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("succeed on correct token", async ({ expect }) => {
    const res = await comma.run(",");
    expect(Results.isOk(res));
  });
});

// INT

enum IntProblem {
  ExpectingNumber = "ExpectingNumber",
  InvalidInt = "InvalidInt",
}

const int = A.int(IntProblem.ExpectingNumber)(IntProblem.InvalidInt);
advancedGroup("int", () => {
  test("succeed on int", async ({ expect }) => {
    const res = await int.run("123");
    expect(res.value).toStrictEqual(123);
  });

  test("fail on none number", async ({ expect }) => {
    const res = await int.run("???");
    expectProblem(expect, res, [IntProblem.ExpectingNumber]);
  });

  test("fail on float", async ({ expect }) => {
    const res = await int.run("1.1");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });

  test("fail on hex", async ({ expect }) => {
    const res = await int.run("0x12ab125");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });

  test("fail on octal", async ({ expect }) => {
    const res = await int.run("0o125");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });

  test("fail on binary", async ({ expect }) => {
    const res = await int.run("0b10101");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });
});

// FLOAT

enum FloatProblems {
  ExpectingNumber = "ExpectingNumber",
  InvalidFloat = "InvalidFloat",
}

const float = A.float(FloatProblems.ExpectingNumber)(
  FloatProblems.InvalidFloat
);

advancedGroup("float", () => {
  test("succeed on int", async ({ expect }) => {
    const res = await float.run("123");
    expect(res.value).toStrictEqual(123);
  });

  test("fail on none number", async ({ expect }) => {
    const res = await float.run("???");
    expectProblem(expect, res, [FloatProblems.ExpectingNumber]);
  });

  test("succed on float", async ({ expect }) => {
    const res = await float.run("1.1");
    expect(res.value).toStrictEqual(1.1);
  });

  test("fail on hex", async ({ expect }) => {
    const res = await float.run("0x12ab125");
    expectProblem(expect, res, [FloatProblems.InvalidFloat]);
  });

  test("fail on octal", async ({ expect }) => {
    const res = await float.run("0o125");
    expectProblem(expect, res, [FloatProblems.InvalidFloat]);
  });

  test("fail on binary", async ({ expect }) => {
    const res = await float.run("0b10101");
    expectProblem(expect, res, [FloatProblems.InvalidFloat]);
  });
});
// NUMBER

enum HexProblem {
  IntNotHex = "IntNotHex",
  OctalNotHex = "OctalNotHex",
  BinaryNotHex = "BinaryNotHex",
  FloatNotHex = "FloatNotHex",
  InvalidHex = "InvalidHex",
  ExpectingNumber = "ExpectingNumber",
}

const hex = A.number({
  int: Results.Err(HexProblem.IntNotHex),
  hex: Results.Ok((n) => n),
  octal: Results.Err(HexProblem.OctalNotHex),
  binary: Results.Err(HexProblem.BinaryNotHex),
  float: Results.Err(HexProblem.FloatNotHex),
  invalid: HexProblem.InvalidHex,
  expecting: HexProblem.ExpectingNumber,
});

advancedGroup("number", () => {
  test("hex parser fail on binary", async ({ expect }) => {
    const res = await hex.run("0b10101");
    expectProblem(expect, res, [HexProblem.BinaryNotHex]);
  });

  test("hex parser fail on octal", async ({ expect }) => {
    const res = await hex.run("0o10725");
    expectProblem(expect, res, [HexProblem.OctalNotHex]);
  });

  test("hex parser fail on int", async ({ expect }) => {
    const res = await hex.run("10725");
    expectProblem(expect, res, [HexProblem.IntNotHex]);
  });

  test("hex parser succeed on hex", async ({ expect }) => {
    const res = await hex.run("0x10ab725");
    expect(res.value).toStrictEqual(17479461);
  });

  test("hex parser fail on float", async ({ expect }) => {
    const res = await hex.run("1082.98");
    expectProblem(expect, res, [HexProblem.FloatNotHex]);
  });

  test("hex parser fail on none number", async ({ expect }) => {
    const res = await hex.run("()");
    expectProblem(expect, res, [HexProblem.ExpectingNumber]);
  });
});

// END

advancedGroup("end", () => {
  test("Success when string is empty", async ({ expect }) => {
    const res = await A.end("NotEnd").run("");
    expect(res.value).toStrictEqual(P.Unit);
  });

  test("Fail when string is not empty", async ({ expect }) => {
    const res = await A.end("NotEnd").run(" ");
    expectProblem(expect, res, ["NotEnd"]);
  });
});

// CHOMPED STRINGS

/**
 * We don't test `getChompedChunk` and `mapChompedString` explicitly since
 * they are used extensivly inthe chomper tests
 */

// CHOMP IF

const NotAB = "NotAB";

const chompIfAB = A.getChompedChunk(
  A.chompIf((c) => c === "a" || c === "b")(NotAB)
);

advancedGroup("chompIf", () => {
  test("empty string", async ({ expect }) => {
    const res = await chompIfAB.run("");
    expectProblem(expect, res, [NotAB]);
  });
  test("single char", async ({ expect }) => {
    const res = await chompIfAB.run("a");
    expect(res.value).toStrictEqual("a");
  });
  test("multi char", async ({ expect }) => {
    const res = await chompIfAB.run("aabba");
    expect(res.value).toStrictEqual("a");
  });
  test("no valid char", async ({ expect }) => {
    const res = await chompIfAB.run("äaabba");
    expectProblem(expect, res, [NotAB]);
  });
});

// CHOMP WHILE

const chompWhileAB = A.getChompedChunk(
  A.chompWhile((c) => c === "a" || c === "b")
);

const chompEscapedString = A.symbol(A.Token('"', "ExpectedQuote"))
  .keep(
    A.chompWhile(
      (c, isEscaped) => [c !== '"' || isEscaped, c === "\\"],
      false
    ).getChompedChunk()
  )
  .skip(A.symbol(A.Token('"', "ExpectedQuote")));

advancedGroup("chompWhile", () => {
  test("empty string", async ({ expect }) => {
    const res = await chompWhileAB.run("");
    expect(res.value).toStrictEqual("");
  });
  test("full ab string", async ({ expect }) => {
    const res = await chompWhileAB.run("abababa");
    expect(res.value).toStrictEqual("abababa");
  });
  test("partial ab string", async ({ expect }) => {
    const res = await chompWhileAB.run("abababaäöå");
    expect(res.value).toStrictEqual("abababa");
  });

  test("non-escaped string", async ({ expect }) => {
    const res = await chompEscapedString.run(JSON.stringify("abababa"));
    expect(res.value).toStrictEqual("abababa");
  });

  test("escaped string", async ({ expect }) => {
    const res = await chompEscapedString.run(JSON.stringify('aba"baba'));
    expect(res.value).toStrictEqual('aba\\"baba');
  });
});

// CHOMP WHILE

const chompWhileAB1 = A.getChompedChunk(
  A.chompWhile1("fail", (c) => c === "a" || c === "b")
);

const chompEscapedString1 = A.symbol(A.Token('"', "ExpectedQuote"))
  .keep(
    A.chompWhile1(
      "fail",
      (c, isEscaped) => [c !== '"' || isEscaped, c === "\\"],
      false
    ).getChompedChunk()
  )
  .skip(A.symbol(A.Token('"', "ExpectedQuote")));

advancedGroup("chompWhile1", () => {
  test("empty string", async ({ expect }) => {
    const res = await chompWhileAB1.run("");
    expect(res.kind).toStrictEqual("Err");
  });
  test("full ab string", async ({ expect }) => {
    const res = await chompWhileAB1.run("abababa");
    expect(res.value).toStrictEqual("abababa");
  });
  test("partial ab string", async ({ expect }) => {
    const res = await chompWhileAB1.run("abababaäöå");
    expect(res.value).toStrictEqual("abababa");
  });

  test("empty string", async ({ expect }) => {
    const res = await chompEscapedString1.run(JSON.stringify(""));
    expect(res.kind).toStrictEqual("Err");
  });
  test("non-escaped string", async ({ expect }) => {
    const res = await chompEscapedString1.run(JSON.stringify("abababa"));
    expect(res.value).toStrictEqual("abababa");
  });

  test("escaped string", async ({ expect }) => {
    const res = await chompEscapedString1.run(JSON.stringify('aba"baba'));
    expect(res.value).toStrictEqual('aba\\"baba');
  });
});

// CHOMP UNTIL

const ExpectedColon = "ExpectedColon";

const chompUntilColon = A.getChompedChunk(
  A.chompUntil(A.Token(":", ExpectedColon))
);

advancedGroup("chompUntil", () => {
  test("empty string produces error", async ({ expect }) => {
    const res = await chompUntilColon.run("");
    expectProblem(expect, res, [ExpectedColon]);
  });

  test("part of string", async ({ expect }) => {
    const res = await chompUntilColon.run("aaa:bbb");
    expect(res.value).toStrictEqual("aaa:");
  });

  test("empty string", async ({ expect }) => {
    const res = await chompUntilColon.run(":bbb");
    expect(res.value).toStrictEqual(":");
  });
});

advancedGroup("chompUntilEndOr", () => {
  const parseHello = A.run(
    A.chompUntilEndOr("hello").andThen(() => A.getPosition)
  );
  test("handles empty string", async ({ expect }) => {
    const res = await parseHello("");
    expect(res.value).toStrictEqual([1, 1]);
  });
  test("parses until keyword", async ({ expect }) => {
    const res = await parseHello("asdnahd hello asdasd");
    expect(res.value).toStrictEqual([1, 14]);
  });
  test("parses until keyword, even newlines", async ({ expect }) => {
    const res = await parseHello("asdnahd\n hello asdasd");
    expect(res.value).toStrictEqual([2, 7]);
  });

  const comment = A.run(A.chompUntilEndOr("\n").andThen(() => A.getPosition));

  test("parses until keyword, even newlines", async ({ expect }) => {
    const res = await comment("asdnahd\n hello asdasd");
    expect(res.value).toStrictEqual([2, 1]);
  });
});

// CONTEXT

enum ContextProblem {
  NotHelloWorld = "NotHelloWorld",
  NotGoodMorning = "NotGoodMorning",
}

enum ContextContext {
  CTX1 = "CTX1",
  CTX2 = "CTX2",
}

const parseHelloWorld = A.inContext(ContextContext.CTX1)(
  A.token(A.Token("Hello, World!", ContextProblem.NotHelloWorld))
);
const parseGoodMorning = A.inContext(ContextContext.CTX2)(
  A.token(A.Token("Good morning!", ContextProblem.NotGoodMorning))
);

const contextParser = A.run(A.oneOf(parseHelloWorld, parseGoodMorning));

advancedGroup("inContext", () => {
  test("first context", async ({ expect }) => {
    const res = await contextParser("Hello, World");
    expect(Results.isErr(res)).toBeTruthy();
    if (Results.isErr(res)) {
      expect(res.value.map((e) => e.contextStack)).toStrictEqual([
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX1 }]),
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX2 }]),
      ]);
    }
  });

  test("second context", async ({ expect }) => {
    const res = await contextParser("Both fail");
    expect(Results.isErr(res)).toBeTruthy();
    if (Results.isErr(res)) {
      expect(res.value.map((e) => e.contextStack)).toStrictEqual([
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX1 }]),
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX2 }]),
      ]);
    }
  });
});

// INDENTATION (getIndent & withIndent)

advancedGroup("indentation", () => {
  test("Get and set indentation", async ({ expect }) => {
    const parser = A.succeed((x: number) => (y: number) => [x, y])
      .apply(A.withIndent(4)(A.getIndent))
      .apply(A.getIndent);
    const res = await parser.run("");
    expect(res.value).toStrictEqual([4, 0]);
  });

  test("Get and set nested indentation", async ({ expect }) => {
    const parser = A.succeed((x: number) => (y: number) => [x, y])
      .apply(A.getIndent.withIndent(4).withIndent(8))
      .apply(A.withIndent(8)(A.withIndent(4)(A.getIndent)));
    const res = await parser.run("");
    expect(res.value).toStrictEqual([12, 12]);
  });

  test("infix indentation", async ({ expect }) => {
    const parser1 = A.succeed(P.Unit).getIndent();
    const res1 = await parser1.run("");
    expect(res1.value).toStrictEqual(0);

    const parser2 = A.succeed(P.Unit).getIndent().withIndent(3);
    const res2 = await parser2.run("");
    expect(res2.value).toStrictEqual(3);
  });
});

// KEYWORD

enum KeywordProblem {
  ExpectingLet = "ExpectingLet",
}

const keywordLet = A.run(
  A.keyword(A.Token("let", KeywordProblem.ExpectingLet))
);

advancedGroup("keyword", () => {
  test("Can parse a valid keyword", async ({ expect }) => {
    const res = await keywordLet("let");
    expect(Results.isOk(res)).toBeTruthy();
  });
  test("Can not parse an invalid keyword", ({ expect }, value) => {
    //@ts-ignore
    const res = await keywordLet(value);
    expect(Results.isErr(res)).toBeTruthy();
  }).with(["letter", "other"]);
});

// POSITION

const alphaNumParser = A.chompWhile((c) => Helpers.isAlphaNum(c) || c === "\n");

advancedGroup("getPosition", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getPosition));
  test("get correct position on empty string", async ({ expect }) => {
    const res = await parser("");
    expect(res.value).toStrictEqual([1, 1]);
  });
  test("get correct position on a line", async ({ expect }) => {
    const res = await parser("aaabbbå");
    expect(res.value).toStrictEqual([1, 7]);
  });
  test("get correct position on multiple lines", async ({ expect }) => {
    const res = await parser("aaa\n\nbbbå");
    expect(res.value).toStrictEqual([3, 4]);
  });
});

advancedGroup("getRow", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getRow));
  test("get correct row on empty string", async ({ expect }) => {
    const res = await parser("");
    expect(res.value).toStrictEqual(1);
  });
  test("get correct row on a line", async ({ expect }) => {
    const res = await parser("aaabbbå");
    expect(res.value).toStrictEqual(1);
  });
  test("get correct row on multiple lines", async ({ expect }) => {
    const res = await parser("aaa\n\nbbbå");
    expect(res.value).toStrictEqual(3);
  });
});
advancedGroup("getCol", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getCol));
  test("get correct column on empty string", async ({ expect }) => {
    const res = await parser("");
    expect(res.value).toStrictEqual(1);
  });
  test("get correct column on a line", async ({ expect }) => {
    const res = await parser("aaabbbå");
    expect(res.value).toStrictEqual(7);
  });
  test("get correct column on multiple lines", async ({ expect }) => {
    const res = await parser("aaa\n\nbbbå");
    expect(res.value).toStrictEqual(4);
  });
});
advancedGroup("getOffset", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getOffset));
  test("get correct offset on empty string", async ({ expect }) => {
    const res = await parser("");
    expect(res.value).toStrictEqual(0);
  });
  test("get correct offset on a line", async ({ expect }) => {
    const res = await parser("aaabbbå");
    expect(res.value).toStrictEqual(6);
  });
  test("get correct offset on multiple lines", async ({ expect }) => {
    const res = await parser("aaa\n\nbbbå");
    expect(res.value).toStrictEqual(8);
  });
});
advancedGroup("getSource", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getSource));
  test("get correct source on empty string", async ({ expect }) => {
    const res = await parser("");
    expect(res.value).toStrictEqual("");
  });
  test("get correct source on a line", async ({ expect }) => {
    const res = await parser("aaabbbå");
    expect(res.value).toStrictEqual("aaabbbå");
  });
  test("get correct source on multiple lines", async ({ expect }) => {
    const res = await parser("aaa\n\nbbbå");
    expect(res.value).toStrictEqual("aaa\n\nbbbå");
  });
});

// VARIABLES

const isLower = (s: string): boolean =>
  Helpers.isAlphaNum(s) && s.toLowerCase() === s;

const typeVar = A.variable({
  start: isLower,
  inner: (c) => Helpers.isAlphaNum(c) || c === "_",
  reserved: new Set(["let", "in", "case", "of"]),
  expecting: "ExpectedTypeVar",
});

advancedGroup("variable", () => {
  test("succeed on valid variable names", async ({ expect }, val) => {
    //@ts-ignore
    const res = await A.run(typeVar)(val);
    expect(res.value).toStrictEqual(val);
  }).with(["ok", "variable_names_are_great", "butThisWorks", "valid"]);

  test("succeed on valid valid part", async ({ expect }, val) => {
    //@ts-ignore
    const res = await A.run(typeVar)(val.test);
    //@ts-ignore
    expect(res.value).toStrictEqual(val.result);
  }).with([{ test: "valid-yes", result: "valid" }]);

  test("fail on invalid variable names", async ({ expect }, val) => {
    //@ts-ignore
    const res = await A.run(typeVar)(val);
    expectProblem(expect, res, ["ExpectedTypeVar"]);
  }).with(["Ok", "&hello", "_what", "åäö"]);

  test("fail on reserved names", async ({ expect }, val) => {
    //@ts-ignore
    const res = await A.run(typeVar)(val);
    expectProblem(expect, res, ["ExpectedTypeVar"]);
  }).with(["let", "in", "case", "of"]);
});

// SEQUENCES

// IntSet

enum BlockProblem {
  LeftCurlyBrace = "LeftCurlyBrace",
  RightCurlyBrace = "RightCurlyBrace",
  Comma = "Comma",
  Int = "Int",
}

const intSet = (trailing: AA.Trailing) =>
  A.sequence({
    start: A.Token("{", BlockProblem.LeftCurlyBrace),
    separator: A.Token(",", BlockProblem.Comma),
    end: A.Token("}", BlockProblem.RightCurlyBrace),
    spaces: A.spaces,
    item: A.int(BlockProblem.Int)(BlockProblem.Int),
    trailing: trailing,
  });

const intSetOptional = A.run(intSet(A.Trailing.Optional));
const intSetMandatory = A.run(intSet(A.Trailing.Mandatory));
const intSetForbidden = A.run(intSet(A.Trailing.Forbidden));

// Nesting

type NestingType = NestingType[];

const nesting: P.Parser<StringCore, NestingType, unknown, BlockProblem> =
  A.sequence({
    start: A.Token("{", BlockProblem.LeftCurlyBrace),
    separator: A.Token(",", BlockProblem.Comma),
    end: A.Token("}", BlockProblem.RightCurlyBrace),
    spaces: A.spaces,
    item: A.lazy(() => nesting),
    trailing: A.Trailing.Optional,
  }).map((x) => x.toArray());

const testSeqNestingSuccess = testSuccessBuilder(nesting);
const testSeqNestingFailure = testFailureBuilder(nesting);

advancedGroup("sequence", () => {
  test("can parse a singel item", async ({ expect }) => {
    const res = await intSetOptional("{ 1337 \n}");
    expect(res.value).toStrictEqual(Immutable.List([1337]));
  });

  test("can parse multiple items", async ({ expect }) => {
    const res = await intSetOptional("{ 1337 \n, 12, 98,\n888}");
    expect(res.value).toStrictEqual(Immutable.List([1337, 12, 98, 888]));
  });

  test("will not parse incorrect items", async ({ expect }) => {
    const res = await intSetOptional("{ 1337 \n, 12.9, 98,\n888}");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("trailing seperator is optional", async ({ expect }) => {
    const res1 = await intSetOptional("{ 1337, \n}");
    expect(res1.value).toStrictEqual(Immutable.List([1337]));
    const res2 = await intSetOptional("{ 1337 \n}");
    expect(res2.value).toStrictEqual(Immutable.List([1337]));
  });

  test("trailing seperator is mandatory", async ({ expect }) => {
    const res1 = await intSetMandatory("{ 1337, \n}");
    expect(res1.value).toStrictEqual(Immutable.List([1337]));
    const res2 = await intSetMandatory("{ 1337 \n}");
    expect(Results.isErr(res2)).toBeTruthy();
  });

  test("trailing seperator is forbidden", async ({ expect }) => {
    const res1 = await intSetForbidden("{ 1337, \n}");
    expect(Results.isErr(res1)).toBeTruthy();
    const res2 = await intSetForbidden("{ 1337 \n}");
    expect(res2.value).toStrictEqual(Immutable.List([1337]));
  });

  testSeqNestingSuccess("empty object", "{}", []);
  testSeqNestingSuccess("nested objects", "{{},{},{}}", [[], [], []]);
  testSeqNestingSuccess("deeply nested objects", "{{{}, {{}}}, {}, {{}}}", [
    [[], [[]]],
    [],
    [[]],
  ]);

  testSeqNestingFailure("Fail when curly braces are missing", "{{{}, ", [
    BlockProblem.LeftCurlyBrace,
    BlockProblem.RightCurlyBrace,
  ]);
  testSeqNestingFailure(
    "Fail when curly braces are missing, 2nd variation",
    "{{{}}, ",
    [BlockProblem.LeftCurlyBrace, BlockProblem.RightCurlyBrace]
  );

  testSeqNestingFailure(
    "Fail when there are random characters inserted",
    "{{{}, {{}}}, d{}, {{}}}",
    [BlockProblem.LeftCurlyBrace, BlockProblem.RightCurlyBrace]
  );
});

// WHITESPACE

advancedGroup("spaces", () => {
  const parser = A.run(A.skip1st(A.spaces)(A.getOffset));
  test("Parse a space character", async ({ expect }) => {
    const res = await parser(" ");
    expect(res.value).toStrictEqual(1);
  });

  test("Parse a carriage return", async ({ expect }) => {
    const res = await parser("\r");
    expect(res.value).toStrictEqual(1);
  });

  test("Parse a new line", async ({ expect }) => {
    const res = await parser("\n");
    expect(res.value).toStrictEqual(1);
  });

  test("Parse multiple space characters", async ({ expect }) => {
    const res = await parser("\n   \r\n  ");
    expect(res.value).toStrictEqual(8);
  });

  test("Stop parsing when non-space characters appear", async ({ expect }) => {
    const res = await parser("\n   \r\n  asdasdasd");
    expect(res.value).toStrictEqual(8);
  });

  test("Can parse empty string", async ({ expect }) => {
    const res = await parser("");
    expect(res.value).toStrictEqual(0);
  });
});

// LINE COMMENT

enum SingleLineCommentProblem {
  NotLineComment = "NotLineComment",
}

const singleLineComment = A.run(
  A.lineComment(A.Token("//", SingleLineCommentProblem.NotLineComment)).andThen(
    () => A.getPosition
  )
);

advancedGroup("lineComment", () => {
  test("can parse a valid line comment", async ({ expect }) => {
    const res = await singleLineComment("// this is a comment");
    expect(Results.isOk(res)).toBeTruthy();
  });

  test("only parses the line until newline", async ({ expect }) => {
    const res = await singleLineComment("// this is a comment\nsomething else");
    expect(res.value).toStrictEqual([2, 1]);
  });

  test("can not parse an invalid line comment", ({ expect }, value) => {
    //@ts-ignore
    const res = await singleLineComment(value);
    expect(Results.isErr(res)).toBeTruthy();
  }).with(["/ this is a comment", " // this is a comment"]);
});

// MULTILINE COMMENT

enum MultiLineCommentProblem {
  NotOpenMultiLineComment = "NotOpenMultiLineComment",
  NotCloseMultiLineComment = "NotCloseMultiLineComment",
}

const multiLineComment = (nestable: AA.Nestable) =>
  A.run(
    A.multiComment(
      A.Token("/*", MultiLineCommentProblem.NotOpenMultiLineComment)
    )(A.Token("*/", MultiLineCommentProblem.NotCloseMultiLineComment))(
      nestable
    ).andThen(() => A.getPosition)
  );

const nestableMulti = multiLineComment(A.Nestable.Nestable);
const notNestableMulti = multiLineComment(A.Nestable.NotNestable);

advancedGroup("multiComment", () => {
  test("Can parse a multiline comment on a singel line", async ({ expect }) => {
    const res = await nestableMulti("/*Can Be Parsed*/adsasd");
    expect(res.value).toStrictEqual([1, 18]);
  });
  test("Can parse a multiline comment across multiple lines", async ({
    expect,
  }) => {
    const res = await nestableMulti("/* \n Can \n Be \n Parsed \n */adsasd");
    expect(res.value).toStrictEqual([5, 4]);
  });

  test("Can parse a nested multiline comment on a singel line", async ({
    expect,
  }) => {
    const res = await nestableMulti("/*Can /*Be*/ Parsed*/adsasd");
    expect(res.value).toStrictEqual([1, 22]);
  });

  test("Can parse a nested multiline comment across multiple lines", async ({
    expect,
  }) => {
    const res = await nestableMulti(
      "/* \n Can /* \n Be */ \n Parsed \n */adsasd"
    );
    expect(res.value).toStrictEqual([5, 4]);
  });
});

// MANY

const manyInts = A.many(A.int("ExpectingInt")("InvalidInt").skip(A.spaces));

const testManyIntsSuccess = testSuccessBuilder(manyInts);

advancedGroup("many", () => {
  testManyIntsSuccess("empty string", "", []);
  testManyIntsSuccess("single int", "123", [123]);
  testManyIntsSuccess("multiple ints", "123 456 789", [123, 456, 789]);
  testManyIntsSuccess(
    "multiple ints with spaces",
    "123  456  789",
    [123, 456, 789]
  );
});

// MANY1
const manyInts1 = A.many1(
  A.int("ExpectingInt")("InvalidInt").skip(A.spaces),
  "ExpectingAtLeastOneInt"
);

const testManyInts1Success = testSuccessBuilder(manyInts1);
const testManyInts1Failure = testFailureBuilder(manyInts1);

advancedGroup("many", () => {
  testManyInts1Success("single int", "123", [123]);
  testManyInts1Success("multiple ints", "123 456 789", [123, 456, 789]);
  testManyInts1Success(
    "multiple ints with spaces",
    "123  456  789",
    [123, 456, 789]
  );
  testManyInts1Failure("empty string", "", ["ExpectingAtLeastOneInt"]);
});

// OPTIONAL

const optionalInt = A.optional(A.int("ExpectingInt")("InvalidInt"));

const testOptionalIntSuccess = testSuccessBuilder(optionalInt);

advancedGroup("optional", () => {
  testOptionalIntSuccess("empty string", "", undefined);
  testOptionalIntSuccess("single int", "123", 123);
  testOptionalIntSuccess("multiple ints", "123 456 789", 123);
  testOptionalIntSuccess("gibberish", "asdasd", undefined);
});
