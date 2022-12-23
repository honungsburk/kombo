import { Expect } from "@japa/expect";
import { test, Group } from "@japa/runner";
import * as Results from "./Result.js";
import * as A from "./Advanced.js";
import * as P from "./Parser.js";
import * as Helpers from "./Helpers.js";
import Immutable from "immutable";

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
  if (Results.isErr(result)) {
    expect(result.value.map((d) => d.problem)).toStrictEqual(toBe);
  }
}

// success

advancedGroup("succeed", () => {
  test("always succeeds", ({ expect }) => {
    expect(A.run(A.succeed(1))("a")).toStrictEqual(Results.Ok(1));
  });
});

// problem
advancedGroup("problem", () => {
  test("always fails", ({ expect }) => {
    expect(Results.isErr(A.run(A.problem(1))("a"))).toStrictEqual(true);
  });
});

// map
advancedGroup("map", () => {
  test("can map values", ({ expect }) => {
    const always1 = A.succeed(1);
    const added1 = A.map((n: number) => n + 1)(always1);
    expect(A.run(added1)("a").value).toStrictEqual(2);
  });
});

// map2
advancedGroup("map2", () => {
  test("can map values", ({ expect }) => {
    const always1 = A.succeed(1);
    const always2 = A.succeed(2);
    const added3 = A.map2((n1: number, n2: number) => n1 + n2)(always1)(
      always2
    );
    expect(A.run(added3)("a").value).toStrictEqual(3);
  });

  test("first parser has problem", ({ expect }) => {
    const problem1 = A.problem("Problem");
    const always2 = A.succeed(2);
    const added1 = A.map2((n1: number, n2: number) => n1 + n2)(problem1)(
      always2
    );
    expect(Results.isErr(A.run(added1)("a"))).toStrictEqual(true);
  });

  test("second parser has problem", ({ expect }) => {
    const problem1 = A.problem("Problem");
    const always2 = A.succeed(2);
    const added1 = A.map2((n1: number, n2: number) => n1 + n2)(always2)(
      problem1
    );
    expect(Results.isErr(A.run(added1)("a"))).toStrictEqual(true);
  });
});

// skip2nd
advancedGroup("skip2nd", () => {
  test("If the 1st parser fails, it fails.", ({ expect }) => {
    const string = A.problem("Problem");
    const number = A.succeed(2);
    const res = A.skip2nd(string)(number);
    expect(Results.isErr(A.run(res)("a"))).toBeTruthy();
  });

  test("If the 2nd parser fails, it fails.", ({ expect }) => {
    const string = A.problem("Problem");
    const number = A.succeed(2);
    const res = A.skip2nd(number)(string);
    expect(Results.isErr(A.run(res)("a"))).toBeTruthy();
  });

  test("Skips the value of the second parser", ({ expect }) => {
    const string = A.succeed("Take Me");
    const number = A.succeed(2);
    const res = A.skip2nd(string)(number);
    expect(A.run(res)("a").value).toStrictEqual("Take Me");
  });
});

// keep
advancedGroup("keep", () => {
  test("Applies the value of the second parser to the function of the first", ({
    expect,
  }) => {
    const add = A.succeed((n: number) => n + 1);
    const number = A.succeed(2);
    const res = A.apply(add)(number);
    expect(A.run(res)("a").value).toStrictEqual(3);
  });

  test("The first parser has a problem", ({ expect }) => {
    const add = A.problem("problem1");
    const number = A.succeed(2);
    const res = A.apply(add)(number);
    expect(Results.isErr(A.run(res)("a"))).toBeTruthy();
  });

  test("The second parser has a problem", ({ expect }) => {
    const add = A.succeed((n: number) => n + 1);
    const number = A.problem("problem2");
    const res = A.apply(add)(number);
    expect(Results.isErr(A.run(res)("a"))).toBeTruthy();
  });
});
// andThen
advancedGroup("andThen", () => {
  test("When both succeed it composes everything nicely", ({ expect }) => {
    const number = A.succeed(2);
    const toString = (n: number) => {
      if (n > 2) {
        return A.succeed("larger then 2");
      } else {
        return A.succeed("2 or smaller");
      }
    };
    const res = A.andThen(toString)(number);
    expect(A.run(res)("a").value).toStrictEqual("2 or smaller");
  });

  test("fail when there is a problem", ({ expect }) => {
    const number = A.problem("Problem");
    const toString = (n: number) => {
      if (n > 2) {
        return A.succeed("larger then 2");
      } else {
        return A.succeed("2 or smaller");
      }
    };
    const res = A.andThen(toString)(number);
    expect(Results.isErr(A.run(res)("a"))).toBeTruthy();
  });

  test("fail when a problem is returned", ({ expect }) => {
    const number = A.succeed(2);
    const toString = (n: number) => {
      if (n > 2) {
        return A.succeed("larger then 2");
      } else {
        return A.problem("Problem");
      }
    };
    const res = A.andThen(toString)(number);
    expect(Results.isErr(A.run(res)("a"))).toBeTruthy();
  });
});

// oneOf

advancedGroup("oneOf", () => {
  test("Given one parser that succeeds, it succeeds", ({ expect }) => {
    const success1 = A.succeed(1);

    const p = A.oneOf(success1);
    expect(A.run(p)("a").value).toStrictEqual(1);
  });

  test("Given one parser that fails, it fails", ({ expect }) => {
    const problem1 = A.problem("problem1");

    const p = A.oneOf(problem1);
    expect(Results.isErr(A.run(p)("a"))).toBeTruthy();
  });

  test("Given two parser that succeeds, it takes the first one", ({
    expect,
  }) => {
    const success1 = A.succeed(1);
    const success2 = A.succeed(2);

    const p = A.oneOf(success1, success2);
    expect(A.run(p)("a").value).toStrictEqual(1);
  });

  test("Given one parser that fails, and one that succeeds it will succeed", ({
    expect,
  }) => {
    const success1 = A.succeed(1);
    const problem1 = A.problem("problem1");

    const p = A.oneOf(problem1, success1);
    expect(A.run(p)("a").value).toStrictEqual(1);
  });

  test("If given multiple parsers it takes the first one that succeeds", ({
    expect,
  }) => {
    const success1 = A.succeed(1);
    const success2 = A.succeed(2);
    const problem1 = A.problem("problem1");
    const problem2 = A.problem("problem1");

    const p = A.oneOf(problem1, problem2, success1, success2);
    expect(A.run(p)("a").value).toStrictEqual(1);
  });
});

// Loop

const append = <A>(as: A[], a: A): A[] => {
  as.push(a);
  return as;
};

A.succeed((_c: false) => A.Loop(append([], "c"))).apply(
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
  test("Parse a list of C:s like 'ccccc'", ({ expect }) => {
    expect(A.run(cChars())("ccccc").value).toStrictEqual([
      "c",
      "c",
      "c",
      "c",
      "c",
    ]);
  });

  test("can detect non 'c' chars", ({ expect }) => {
    expect(A.run(cChars())("ccbcc").value).toStrictEqual(["c", "c"]);
  });

  test("can handle empty string 'c' chars", ({ expect }) => {
    expect(A.run(cChars())("ccbcc").value).toStrictEqual(["c", "c"]);
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
  test("succeed", ({ expect }) => {
    const res = A.run(backtrackExample)("  , 4");
    expect(Results.isOk(res));
    if (Results.isOk(res)) {
      expect(res.value).toStrictEqual(4);
    }
  });

  test("fail", ({ expect }) => {
    const res = A.run(backtrackExample)("  ,");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("can not go back", ({ expect }) => {
    const res = A.run(backtrackExample)("  , a");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("can go back", ({ expect }) => {
    const res = A.run(backtrackExample)("  ]");
    expect(Results.isOk(res));
    if (Results.isOk(res)) {
      expect(res.value).toStrictEqual(undefined);
    }
  });

  test("can not go back again", ({ expect }) => {
    const res = A.run(backtrackExample)("  a");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("fail on first char", ({ expect }) => {
    const res = A.run(backtrackExample)("abc");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

// TOKEN

const comma = A.token(A.Token(",", "ExpectingComma"));
advancedGroup("token", () => {
  test("fail on other token", ({ expect }) => {
    const res = A.run(comma)("abc");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("succeed on correct token", ({ expect }) => {
    const res = A.run(comma)(",");
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
  test("succeed on int", ({ expect }) => {
    const res = A.run(int)("123");
    expect(res.value).toStrictEqual(123);
  });

  test("fail on none number", ({ expect }) => {
    const res = A.run(int)("???");
    expectProblem(expect, res, [IntProblem.ExpectingNumber]);
  });

  test("fail on float", ({ expect }) => {
    const res = A.run(int)("1.1");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });

  test("fail on hex", ({ expect }) => {
    const res = A.run(int)("0x12ab125");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });

  test("fail on octal", ({ expect }) => {
    const res = A.run(int)("0o125");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });

  test("fail on binary", ({ expect }) => {
    const res = A.run(int)("0b10101");
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
  test("succeed on int", ({ expect }) => {
    const res = A.run(float)("123");
    expect(res.value).toStrictEqual(123);
  });

  test("fail on none number", ({ expect }) => {
    const res = A.run(float)("???");
    expectProblem(expect, res, [FloatProblems.ExpectingNumber]);
  });

  test("succed on float", ({ expect }) => {
    const res = A.run(float)("1.1");
    expect(res.value).toStrictEqual(1.1);
  });

  test("fail on hex", ({ expect }) => {
    const res = A.run(float)("0x12ab125");
    expectProblem(expect, res, [FloatProblems.InvalidFloat]);
  });

  test("fail on octal", ({ expect }) => {
    const res = A.run(float)("0o125");
    expectProblem(expect, res, [FloatProblems.InvalidFloat]);
  });

  test("fail on binary", ({ expect }) => {
    const res = A.run(float)("0b10101");
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
  test("hex parser fail on binary", ({ expect }) => {
    const res = A.run(hex)("0b10101");
    expectProblem(expect, res, [HexProblem.BinaryNotHex]);
  });

  test("hex parser fail on octal", ({ expect }) => {
    const res = A.run(hex)("0o10725");
    expectProblem(expect, res, [HexProblem.OctalNotHex]);
  });

  test("hex parser fail on int", ({ expect }) => {
    const res = A.run(hex)("10725");
    expectProblem(expect, res, [HexProblem.IntNotHex]);
  });

  test("hex parser succeed on hex", ({ expect }) => {
    const res = A.run(hex)("0x10ab725");
    expect(res.value).toStrictEqual(17479461);
  });

  test("hex parser fail on float", ({ expect }) => {
    const res = A.run(hex)("1082.98");
    expectProblem(expect, res, [HexProblem.FloatNotHex]);
  });

  test("hex parser fail on none number", ({ expect }) => {
    const res = A.run(hex)("()");
    expectProblem(expect, res, [HexProblem.ExpectingNumber]);
  });
});

// END

advancedGroup("end", () => {
  test("Success when string is empty", ({ expect }) => {
    const res = A.run(A.end("NotEnd"))("");
    expect(res.value).toStrictEqual(A.Unit);
  });

  test("Fail when string is not empty", ({ expect }) => {
    const res = A.run(A.end("NotEnd"))(" ");
    expectProblem(expect, res, ["NotEnd"]);
  });
});

// CHOMPED STRINGS

/**
 * We don't test `getChompedString` and `mapChompedString` explicitly since
 * they are used extensivly inthe chomper tests
 */

// CHOMP IF

const NotAB = "NotAB";

const chompIfAB = A.getChompedString(
  A.chompIf((c) => c === "a" || c === "b")(NotAB)
);

advancedGroup("chompIf", () => {
  test("empty string", ({ expect }) => {
    const res = A.run(chompIfAB)("");
    expectProblem(expect, res, [NotAB]);
  });
  test("single char", ({ expect }) => {
    const res = A.run(chompIfAB)("a");
    expect(res.value).toStrictEqual("a");
  });
  test("multi char", ({ expect }) => {
    const res = A.run(chompIfAB)("aabba");
    expect(res.value).toStrictEqual("a");
  });
  test("no valid char", ({ expect }) => {
    const res = A.run(chompIfAB)("äaabba");
    expectProblem(expect, res, [NotAB]);
  });
});

// CHOMP WHILE

const chompWhileAB = A.getChompedString(
  A.chompWhile((c) => c === "a" || c === "b")
);

advancedGroup("chompWhile", () => {
  test("empty string", ({ expect }) => {
    const res = A.run(chompWhileAB)("");
    expect(res.value).toStrictEqual("");
  });
  test("full ab string", ({ expect }) => {
    const res = A.run(chompWhileAB)("abababa");
    expect(res.value).toStrictEqual("abababa");
  });
  test("partial ab string", ({ expect }) => {
    const res = A.run(chompWhileAB)("abababaäöå");
    expect(res.value).toStrictEqual("abababa");
  });
});

// CHOMP UNTIL

const ExpectedColon = "ExpectedColon";

const chompUntilColon = A.getChompedString(
  A.chompUntil(A.Token(":", ExpectedColon))
);

advancedGroup("chompUntil", () => {
  test("empty string produces error", ({ expect }) => {
    const res = A.run(chompUntilColon)("");
    expectProblem(expect, res, [ExpectedColon]);
  });

  test("part of string", ({ expect }) => {
    const res = A.run(chompUntilColon)("aaa:bbb");
    expect(res.value).toStrictEqual("aaa:");
  });

  test("empty string", ({ expect }) => {
    const res = A.run(chompUntilColon)(":bbb");
    expect(res.value).toStrictEqual(":");
  });
});

advancedGroup("chompUntilEndOr", () => {
  const parseHello = A.run(
    A.chompUntilEndOr("hello").andThen(() => A.getPosition)
  );
  test("handles empty string", ({ expect }) => {
    const res = parseHello("");
    expect(res.value).toStrictEqual([1, 1]);
  });
  test("parses until keyword", ({ expect }) => {
    const res = parseHello("asdnahd hello asdasd");
    expect(res.value).toStrictEqual([1, 14]);
  });
  test("parses until keyword, even newlines", ({ expect }) => {
    const res = parseHello("asdnahd\n hello asdasd");
    expect(res.value).toStrictEqual([2, 7]);
  });

  const comment = A.run(A.chompUntilEndOr("\n").andThen(() => A.getPosition));

  test("parses until keyword, even newlines", ({ expect }) => {
    const res = comment("asdnahd\n hello asdasd");
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
  test("first context", ({ expect }) => {
    const res = contextParser("Hello, World");
    expect(Results.isErr(res)).toBeTruthy();
    if (Results.isErr(res)) {
      expect(res.value.map((e) => e.contextStack)).toStrictEqual([
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX2 }]),
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX1 }]),
      ]);
    }
  });

  test("second context", ({ expect }) => {
    const res = contextParser("Both fail");
    expect(Results.isErr(res)).toBeTruthy();
    if (Results.isErr(res)) {
      expect(res.value.map((e) => e.contextStack)).toStrictEqual([
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX2 }]),
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX1 }]),
      ]);
    }
  });
});

// INDENTATION (getIndent & withIndent)

advancedGroup("indentation", () => {
  test("Get and set indentation", ({ expect }) => {
    const parser = A.succeed((x: number) => (y: number) => [x, y])
      .apply(A.withIndent(4)(A.getIndent))
      .apply(A.getIndent);
    const res = A.run(parser)("");
    expect(res.value).toStrictEqual([4, 0]);
  });

  test("Get and set nested indentation", ({ expect }) => {
    const parser = A.succeed((x: number) => (y: number) => [x, y])
      .apply(A.getIndent.withIndent(4).withIndent(8))
      .apply(A.withIndent(8)(A.withIndent(4)(A.getIndent)));
    const res = A.run(parser)("");
    expect(res.value).toStrictEqual([12, 12]);
  });

  test("infix indentation", ({ expect }) => {
    const parser1 = A.succeed(A.Unit).getIndent();
    const res1 = A.run(parser1)("");
    expect(res1.value).toStrictEqual(0);

    const parser2 = A.succeed(A.Unit).getIndent().withIndent(3);
    const res2 = A.run(parser2)("");
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
  test("Can parse a valid keyword", ({ expect }) => {
    const res = keywordLet("let");
    expect(Results.isOk(res)).toBeTruthy();
  });
  test("Can not parse an invalid keyword", ({ expect }, value) => {
    //@ts-ignore
    const res = keywordLet(value);
    expect(Results.isErr(res)).toBeTruthy();
  }).with(["letter", "other"]);
});

// POSITION

const alphaNumParser = A.chompWhile((c) => Helpers.isAlphaNum(c) || c === "\n");

advancedGroup("getPosition", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getPosition));
  test("get correct position on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.value).toStrictEqual([1, 1]);
  });
  test("get correct position on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.value).toStrictEqual([1, 7]);
  });
  test("get correct position on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
    expect(res.value).toStrictEqual([3, 4]);
  });
});

advancedGroup("getRow", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getRow));
  test("get correct row on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.value).toStrictEqual(1);
  });
  test("get correct row on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.value).toStrictEqual(1);
  });
  test("get correct row on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
    expect(res.value).toStrictEqual(3);
  });
});
advancedGroup("getCol", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getCol));
  test("get correct column on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.value).toStrictEqual(1);
  });
  test("get correct column on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.value).toStrictEqual(7);
  });
  test("get correct column on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
    expect(res.value).toStrictEqual(4);
  });
});
advancedGroup("getOffset", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getOffset));
  test("get correct offset on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.value).toStrictEqual(0);
  });
  test("get correct offset on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.value).toStrictEqual(6);
  });
  test("get correct offset on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
    expect(res.value).toStrictEqual(8);
  });
});
advancedGroup("getSource", () => {
  const parser = A.run(alphaNumParser.andThen(() => A.getSource));
  test("get correct source on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.value).toStrictEqual("");
  });
  test("get correct source on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.value).toStrictEqual("aaabbbå");
  });
  test("get correct source on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
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
  test("succeed on valid variable names", ({ expect }, val) => {
    //@ts-ignore
    const res = A.run(typeVar)(val);
    expect(res.value).toStrictEqual(val);
  }).with(["ok", "variable_names_are_great", "butThisWorks", "valid"]);

  test("succeed on valid valid part", ({ expect }, val) => {
    //@ts-ignore
    const res = A.run(typeVar)(val.test);
    //@ts-ignore
    expect(res.value).toStrictEqual(val.result);
  }).with([{ test: "valid-yes", result: "valid" }]);

  test("fail on invalid variable names", ({ expect }, val) => {
    //@ts-ignore
    const res = A.run(typeVar)(val);
    expectProblem(expect, res, ["ExpectedTypeVar"]);
  }).with(["Ok", "&hello", "_what", "åäö"]);

  test("fail on reserved names", ({ expect }, val) => {
    //@ts-ignore
    const res = A.run(typeVar)(val);
    expectProblem(expect, res, ["ExpectedTypeVar"]);
  }).with(["let", "in", "case", "of"]);
});

// SEQUENCES

enum BlockProblem {
  LeftCurlyBrace = "LeftCurlyBrace",
  RightCurlyBrace = "RightCurlyBrace",
  Comma = "Comma",
  Int = "Int",
}

const intSet = (trailing: A.Trailing) =>
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

advancedGroup("sequence", () => {
  test("can parse a singel item", ({ expect }) => {
    const res = intSetOptional("{ 1337 \n}");
    expect(res.value).toStrictEqual(Immutable.List([1337]));
  });

  test("can parse multiple items", ({ expect }) => {
    const res = intSetOptional("{ 1337 \n, 12, 98,\n888}");
    expect(res.value).toStrictEqual(Immutable.List([1337, 12, 98, 888]));
  });

  test("will not parse incorrect items", ({ expect }) => {
    const res = intSetOptional("{ 1337 \n, 12.9, 98,\n888}");
    expect(Results.isErr(res)).toBeTruthy();
  });

  test("trailing seperator is optional", ({ expect }) => {
    const res1 = intSetOptional("{ 1337, \n}");
    expect(res1.value).toStrictEqual(Immutable.List([1337]));
    const res2 = intSetOptional("{ 1337 \n}");
    expect(res2.value).toStrictEqual(Immutable.List([1337]));
  });

  test("trailing seperator is mandatory", ({ expect }) => {
    const res1 = intSetMandatory("{ 1337, \n}");
    expect(res1.value).toStrictEqual(Immutable.List([1337]));
    const res2 = intSetMandatory("{ 1337 \n}");
    expect(Results.isErr(res2)).toBeTruthy();
  });

  test("trailing seperator is forbidden", ({ expect }) => {
    const res1 = intSetForbidden("{ 1337, \n}");
    expect(Results.isErr(res1)).toBeTruthy();
    const res2 = intSetForbidden("{ 1337 \n}");
    expect(res2.value).toStrictEqual(Immutable.List([1337]));
  });
});

// WHITESPACE

advancedGroup("spaces", () => {
  const parser = A.run(A.skip1st(A.spaces)(A.getOffset));
  test("Parse a space character", ({ expect }) => {
    const res = parser(" ");
    expect(res.value).toStrictEqual(1);
  });

  test("Parse a carriage return", ({ expect }) => {
    const res = parser("\r");
    expect(res.value).toStrictEqual(1);
  });

  test("Parse a new line", ({ expect }) => {
    const res = parser("\n");
    expect(res.value).toStrictEqual(1);
  });

  test("Parse multiple space characters", ({ expect }) => {
    const res = parser("\n   \r\n  ");
    expect(res.value).toStrictEqual(8);
  });

  test("Stop parsing when non-space characters appear", ({ expect }) => {
    const res = parser("\n   \r\n  asdasdasd");
    expect(res.value).toStrictEqual(8);
  });

  test("Can parse empty string", ({ expect }) => {
    const res = parser("");
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
  test("can parse a valid line comment", ({ expect }) => {
    const res = singleLineComment("// this is a comment");
    expect(Results.isOk(res)).toBeTruthy();
  });

  test("only parses the line until newline", ({ expect }) => {
    const res = singleLineComment("// this is a comment\nsomething else");
    expect(res.value).toStrictEqual([2, 1]);
  });

  test("can not parse an invalid line comment", ({ expect }, value) => {
    //@ts-ignore
    const res = singleLineComment(value);
    expect(Results.isErr(res)).toBeTruthy();
  }).with(["/ this is a comment", " // this is a comment"]);
});

// MULTILINE COMMENT

enum MultiLineCommentProblem {
  NotOpenMultiLineComment = "NotOpenMultiLineComment",
  NotCloseMultiLineComment = "NotCloseMultiLineComment",
}

const multiLineComment = (nestable: A.Nestable) =>
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
  test("Can parse a multiline comment on a singel line", ({ expect }) => {
    const res = nestableMulti("/*Can Be Parsed*/adsasd");
    expect(res.value).toStrictEqual([1, 18]);
  });
  test("Can parse a multiline comment across multiple lines", ({ expect }) => {
    const res = nestableMulti("/* \n Can \n Be \n Parsed \n */adsasd");
    expect(res.value).toStrictEqual([5, 4]);
  });

  test("Can parse a nested multiline comment on a singel line", ({
    expect,
  }) => {
    const res = nestableMulti("/*Can /*Be*/ Parsed*/adsasd");
    expect(res.value).toStrictEqual([1, 22]);
  });

  test("Can parse a nested multiline comment across multiple lines", ({
    expect,
  }) => {
    const res = nestableMulti("/* \n Can /* \n Be */ \n Parsed \n */adsasd");
    expect(res.value).toStrictEqual([5, 4]);
  });
});
