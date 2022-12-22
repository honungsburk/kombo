import { Expect } from "@japa/expect";
import { test, Group } from "@japa/runner";
import * as Results from "ts-results-es";
import * as P from "./Advanced.js";
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

function expectProblem<A>(
  expect: Expect,
  result: Results.Result<any, P.DeadEnd<A>[]>,
  toBe: A[]
): void {
  expect(result.err).toBeTruthy();
  if (result.err) {
    expect(result.val.map((d) => d.problem)).toStrictEqual(toBe);
  }
}

// success

advancedGroup("succeed", () => {
  test("always succeeds", ({ expect }) => {
    expect(P.run(P.succeed(1))("a")).toStrictEqual(Results.Ok(1));
  });
});

// problem
advancedGroup("problem", () => {
  test("always fails", ({ expect }) => {
    expect(P.run(P.problem(1))("a").err).toStrictEqual(true);
  });
});

// map
advancedGroup("map", () => {
  test("can map values", ({ expect }) => {
    const always1 = P.succeed(1);
    const added1 = P.map((n: number) => n + 1)(always1);
    expect(P.run(added1)("a").val).toStrictEqual(2);
  });
});

// map2
advancedGroup("map2", () => {
  test("can map values", ({ expect }) => {
    const always1 = P.succeed(1);
    const always2 = P.succeed(2);
    const added3 = P.map2((n1: number, n2: number) => n1 + n2)(always1)(
      always2
    );
    expect(P.run(added3)("a").val).toStrictEqual(3);
  });

  test("first parser has problem", ({ expect }) => {
    const problem1 = P.problem("Problem");
    const always2 = P.succeed(2);
    const added1 = P.map2((n1: number, n2: number) => n1 + n2)(problem1)(
      always2
    );
    expect(P.run(added1)("a").err).toStrictEqual(true);
  });

  test("second parser has problem", ({ expect }) => {
    const problem1 = P.problem("Problem");
    const always2 = P.succeed(2);
    const added1 = P.map2((n1: number, n2: number) => n1 + n2)(always2)(
      problem1
    );
    expect(P.run(added1)("a").err).toStrictEqual(true);
  });
});

// skip2nd
advancedGroup("skip2nd", () => {
  test("If the 1st parser fails, it fails.", ({ expect }) => {
    const string = P.problem("Problem");
    const number = P.succeed(2);
    const res = P.skip2nd(string)(number);
    expect(P.run(res)("a").err).toBeTruthy();
  });

  test("If the 2nd parser fails, it fails.", ({ expect }) => {
    const string = P.problem("Problem");
    const number = P.succeed(2);
    const res = P.skip2nd(number)(string);
    expect(P.run(res)("a").err).toBeTruthy();
  });

  test("Skips the value of the second parser", ({ expect }) => {
    const string = P.succeed("Take Me");
    const number = P.succeed(2);
    const res = P.skip2nd(string)(number);
    expect(P.run(res)("a").val).toStrictEqual("Take Me");
  });
});

// keep
advancedGroup("keep", () => {
  test("Applies the value of the second parser to the function of the first", ({
    expect,
  }) => {
    const add = P.succeed((n: number) => n + 1);
    const number = P.succeed(2);
    const res = P.apply(add)(number);
    expect(P.run(res)("a").val).toStrictEqual(3);
  });

  test("The first parser has a problem", ({ expect }) => {
    const add = P.problem("problem1");
    const number = P.succeed(2);
    const res = P.apply(add)(number);
    expect(P.run(res)("a").err).toBeTruthy();
  });

  test("The second parser has a problem", ({ expect }) => {
    const add = P.succeed((n: number) => n + 1);
    const number = P.problem("problem2");
    const res = P.apply(add)(number);
    expect(P.run(res)("a").err).toBeTruthy();
  });
});
// andThen
advancedGroup("andThen", () => {
  test("When both succeed it composes everything nicely", ({ expect }) => {
    const number = P.succeed(2);
    const toString = (n: number) => {
      if (n > 2) {
        return P.succeed("larger then 2");
      } else {
        return P.succeed("2 or smaller");
      }
    };
    const res = P.andThen(toString)(number);
    expect(P.run(res)("a").val).toStrictEqual("2 or smaller");
  });

  test("fail when there is a problem", ({ expect }) => {
    const number = P.problem("Problem");
    const toString = (n: number) => {
      if (n > 2) {
        return P.succeed("larger then 2");
      } else {
        return P.succeed("2 or smaller");
      }
    };
    const res = P.andThen(toString)(number);
    expect(P.run(res)("a").err).toBeTruthy();
  });

  test("fail when a problem is returned", ({ expect }) => {
    const number = P.succeed(2);
    const toString = (n: number) => {
      if (n > 2) {
        return P.succeed("larger then 2");
      } else {
        return P.problem("Problem");
      }
    };
    const res = P.andThen(toString)(number);
    expect(P.run(res)("a").err).toBeTruthy();
  });
});

// oneOf

advancedGroup("oneOf", () => {
  test("Given one parser that succeeds, it succeeds", ({ expect }) => {
    const success1 = P.succeed(1);

    const p = P.oneOf(success1);
    expect(P.run(p)("a").val).toStrictEqual(1);
  });

  test("Given one parser that fails, it fails", ({ expect }) => {
    const problem1 = P.problem("problem1");

    const p = P.oneOf(problem1);
    expect(P.run(p)("a").err).toBeTruthy();
  });

  test("Given two parser that succeeds, it takes the first one", ({
    expect,
  }) => {
    const success1 = P.succeed(1);
    const success2 = P.succeed(2);

    const p = P.oneOf(success1, success2);
    expect(P.run(p)("a").val).toStrictEqual(1);
  });

  test("Given one parser that fails, and one that succeeds it will succeed", ({
    expect,
  }) => {
    const success1 = P.succeed(1);
    const problem1 = P.problem("problem1");

    const p = P.oneOf(problem1, success1);
    expect(P.run(p)("a").val).toStrictEqual(1);
  });

  test("If given multiple parsers it takes the first one that succeeds", ({
    expect,
  }) => {
    const success1 = P.succeed(1);
    const success2 = P.succeed(2);
    const problem1 = P.problem("problem1");
    const problem2 = P.problem("problem1");

    const p = P.oneOf(problem1, problem2, success1, success2);
    expect(P.run(p)("a").val).toStrictEqual(1);
  });
});

// Loop

const append = <A>(as: A[], a: A): A[] => {
  as.push(a);
  return as;
};

P.succeed((_c: false) => P.Loop(append([], "c"))).apply(
  P.token(P.Token("c", "Expected a 'c'"))
);

// Mutating the list... okay in this implementation but bad practice in general
const cCharsHelper = (chars: string[]) =>
  P.oneOf(
    P.succeed((_c: any) => P.Loop(append(chars, "c"))).apply(
      P.token(P.Token("c", "Expected a 'c'"))
    ),
    P.succeed(P.Done(chars))
  );

const cChars = () => P.loop([] as string[])(cCharsHelper);

advancedGroup("loop", () => {
  test("Parse a list of C:s like 'ccccc'", ({ expect }) => {
    expect(P.run(cChars())("ccccc").val).toStrictEqual([
      "c",
      "c",
      "c",
      "c",
      "c",
    ]);
  });

  test("can detect non 'c' chars", ({ expect }) => {
    expect(P.run(cChars())("ccbcc").val).toStrictEqual(["c", "c"]);
  });

  test("can handle empty string 'c' chars", ({ expect }) => {
    expect(P.run(cChars())("ccbcc").val).toStrictEqual(["c", "c"]);
  });
});

// BACKTRACKABLE

enum BacktrackableProblem {
  Comma = "Comma",
  LeftSquareBracket = "LeftSquareBracket",
  Int = "Int",
}

const backtrackExample = P.oneOf(
  P.succeed((x: number) => x)
    .skip(P.backtrackable(P.spaces))
    .skip(P.token(P.Token(",", BacktrackableProblem.Comma)))
    .skip(P.spaces)
    .apply(P.int(BacktrackableProblem.Int)(BacktrackableProblem.Int)),
  P.succeed(undefined)
    .skip(P.spaces)
    .skip(P.token(P.Token("]", BacktrackableProblem.LeftSquareBracket)))
);

advancedGroup("backtrackable", () => {
  test("succeed", ({ expect }) => {
    const res = P.run(backtrackExample)("  , 4");
    expect(res.ok);
    if (res.ok) {
      expect(res.val).toStrictEqual(4);
    }
  });

  test("fail", ({ expect }) => {
    const res = P.run(backtrackExample)("  ,");
    expect(res.err).toBeTruthy();
  });

  test("can not go back", ({ expect }) => {
    const res = P.run(backtrackExample)("  , a");
    expect(res.err).toBeTruthy();
  });

  test("can go back", ({ expect }) => {
    const res = P.run(backtrackExample)("  ]");
    expect(res.ok);
    if (res.ok) {
      expect(res.val).toStrictEqual(undefined);
    }
  });

  test("can not go back again", ({ expect }) => {
    const res = P.run(backtrackExample)("  a");
    expect(res.err).toBeTruthy();
  });

  test("fail on first char", ({ expect }) => {
    const res = P.run(backtrackExample)("abc");
    expect(res.err).toBeTruthy();
  });
});

// TOKEN

const comma = P.token(P.Token(",", "ExpectingComma"));
advancedGroup("token", () => {
  test("fail on other token", ({ expect }) => {
    const res = P.run(comma)("abc");
    expect(res.err).toBeTruthy();
  });

  test("succeed on correct token", ({ expect }) => {
    const res = P.run(comma)(",");
    expect(res.ok);
  });
});

// INT

enum IntProblem {
  ExpectingNumber = "ExpectingNumber",
  InvalidInt = "InvalidInt",
}

const int = P.int(IntProblem.ExpectingNumber)(IntProblem.InvalidInt);
advancedGroup("int", () => {
  test("succeed on int", ({ expect }) => {
    const res = P.run(int)("123");
    expect(res.val).toStrictEqual(123);
  });

  test("fail on none number", ({ expect }) => {
    const res = P.run(int)("???");
    expectProblem(expect, res, [IntProblem.ExpectingNumber]);
  });

  test("fail on float", ({ expect }) => {
    const res = P.run(int)("1.1");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });

  test("fail on hex", ({ expect }) => {
    const res = P.run(int)("0x12ab125");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });

  test("fail on octal", ({ expect }) => {
    const res = P.run(int)("0o125");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });

  test("fail on binary", ({ expect }) => {
    const res = P.run(int)("0b10101");
    expectProblem(expect, res, [IntProblem.InvalidInt]);
  });
});

// FLOAT

enum FloatProblems {
  ExpectingNumber = "ExpectingNumber",
  InvalidFloat = "InvalidFloat",
}

const float = P.float(FloatProblems.ExpectingNumber)(
  FloatProblems.InvalidFloat
);

advancedGroup("float", () => {
  test("succeed on int", ({ expect }) => {
    const res = P.run(float)("123");
    expect(res.val).toStrictEqual(123);
  });

  test("fail on none number", ({ expect }) => {
    const res = P.run(float)("???");
    expectProblem(expect, res, [FloatProblems.ExpectingNumber]);
  });

  test("succed on float", ({ expect }) => {
    const res = P.run(float)("1.1");
    expect(res.val).toStrictEqual(1.1);
  });

  test("fail on hex", ({ expect }) => {
    const res = P.run(float)("0x12ab125");
    expectProblem(expect, res, [FloatProblems.InvalidFloat]);
  });

  test("fail on octal", ({ expect }) => {
    const res = P.run(float)("0o125");
    expectProblem(expect, res, [FloatProblems.InvalidFloat]);
  });

  test("fail on binary", ({ expect }) => {
    const res = P.run(float)("0b10101");
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

const hex = P.number({
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
    const res = P.run(hex)("0b10101");
    expectProblem(expect, res, [HexProblem.BinaryNotHex]);
  });

  test("hex parser fail on octal", ({ expect }) => {
    const res = P.run(hex)("0o10725");
    expectProblem(expect, res, [HexProblem.OctalNotHex]);
  });

  test("hex parser fail on int", ({ expect }) => {
    const res = P.run(hex)("10725");
    expectProblem(expect, res, [HexProblem.IntNotHex]);
  });

  test("hex parser succeed on hex", ({ expect }) => {
    const res = P.run(hex)("0x10ab725");
    expect(res.val).toStrictEqual(17479461);
  });

  test("hex parser fail on float", ({ expect }) => {
    const res = P.run(hex)("1082.98");
    expectProblem(expect, res, [HexProblem.FloatNotHex]);
  });

  test("hex parser fail on none number", ({ expect }) => {
    const res = P.run(hex)("()");
    expectProblem(expect, res, [HexProblem.ExpectingNumber]);
  });
});

// END

advancedGroup("end", () => {
  test("Success when string is empty", ({ expect }) => {
    const res = P.run(P.end("NotEnd"))("");
    expect(res.val).toStrictEqual(P.Unit);
  });

  test("Fail when string is not empty", ({ expect }) => {
    const res = P.run(P.end("NotEnd"))(" ");
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

const chompIfAB = P.getChompedString(
  P.chompIf((c) => c === "a" || c === "b")(NotAB)
);

advancedGroup("chompIf", () => {
  test("empty string", ({ expect }) => {
    const res = P.run(chompIfAB)("");
    expectProblem(expect, res, [NotAB]);
  });
  test("single char", ({ expect }) => {
    const res = P.run(chompIfAB)("a");
    expect(res.val).toStrictEqual("a");
  });
  test("multi char", ({ expect }) => {
    const res = P.run(chompIfAB)("aabba");
    expect(res.val).toStrictEqual("a");
  });
  test("no valid char", ({ expect }) => {
    const res = P.run(chompIfAB)("äaabba");
    expectProblem(expect, res, [NotAB]);
  });
});

// CHOMP WHILE

const chompWhileAB = P.getChompedString(
  P.chompWhile((c) => c === "a" || c === "b")
);

advancedGroup("chompWhile", () => {
  test("empty string", ({ expect }) => {
    const res = P.run(chompWhileAB)("");
    expect(res.val).toStrictEqual("");
  });
  test("full ab string", ({ expect }) => {
    const res = P.run(chompWhileAB)("abababa");
    expect(res.val).toStrictEqual("abababa");
  });
  test("partial ab string", ({ expect }) => {
    const res = P.run(chompWhileAB)("abababaäöå");
    expect(res.val).toStrictEqual("abababa");
  });
});

// CHOMP UNTIL

const ExpectedColon = "ExpectedColon";

const chompUntilColon = P.getChompedString(
  P.chompUntil(P.Token(":", ExpectedColon))
);

advancedGroup("chompUntil", () => {
  test("empty string produces error", ({ expect }) => {
    const res = P.run(chompUntilColon)("");
    expectProblem(expect, res, [ExpectedColon]);
  });

  test("part of string", ({ expect }) => {
    const res = P.run(chompUntilColon)("aaa:bbb");
    expect(res.val).toStrictEqual("aaa:");
  });

  test("empty string", ({ expect }) => {
    const res = P.run(chompUntilColon)(":bbb");
    expect(res.val).toStrictEqual(":");
  });
});

advancedGroup("chompUntilEndOr", () => {
  const parseHello = P.run(
    P.chompUntilEndOr("hello").andThen(() => P.getPosition)
  );
  test("handles empty string", ({ expect }) => {
    const res = parseHello("");
    expect(res.val).toStrictEqual([1, 1]);
  });
  test("parses until keyword", ({ expect }) => {
    const res = parseHello("asdnahd hello asdasd");
    expect(res.val).toStrictEqual([1, 14]);
  });
  test("parses until keyword, even newlines", ({ expect }) => {
    const res = parseHello("asdnahd\n hello asdasd");
    expect(res.val).toStrictEqual([2, 7]);
  });

  const comment = P.run(P.chompUntilEndOr("\n").andThen(() => P.getPosition));

  test("parses until keyword, even newlines", ({ expect }) => {
    const res = comment("asdnahd\n hello asdasd");
    expect(res.val).toStrictEqual([2, 1]);
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

const parseHelloWorld = P.inContext(ContextContext.CTX1)(
  P.token(P.Token("Hello, World!", ContextProblem.NotHelloWorld))
);
const parseGoodMorning = P.inContext(ContextContext.CTX2)(
  P.token(P.Token("Good morning!", ContextProblem.NotGoodMorning))
);

const contextParser = P.run(P.oneOf(parseHelloWorld, parseGoodMorning));

advancedGroup("inContext", () => {
  test("first context", ({ expect }) => {
    const res = contextParser("Hello, World");
    expect(res.err).toBeTruthy();
    if (res.err) {
      expect(res.val.map((e) => e.contextStack)).toStrictEqual([
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX2 }]),
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX1 }]),
      ]);
    }
  });

  test("second context", ({ expect }) => {
    const res = contextParser("Both fail");
    expect(res.err).toBeTruthy();
    if (res.err) {
      expect(res.val.map((e) => e.contextStack)).toStrictEqual([
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX2 }]),
        Immutable.Stack([{ row: 1, col: 1, context: ContextContext.CTX1 }]),
      ]);
    }
  });
});

// INDENTATION (getIndent & withIndent)

advancedGroup("indentation", () => {
  test("Get and set indentation", ({ expect }) => {
    const parser = P.succeed((x: number) => (y: number) => [x, y])
      .apply(P.withIndent(4)(P.getIndent))
      .apply(P.getIndent);
    const res = P.run(parser)("");
    expect(res.val).toStrictEqual([4, 0]);
  });

  test("Get and set nested indentation", ({ expect }) => {
    const parser = P.succeed((x: number) => (y: number) => [x, y])
      .apply(P.getIndent.withIndent(4).withIndent(8))
      .apply(P.withIndent(8)(P.withIndent(4)(P.getIndent)));
    const res = P.run(parser)("");
    expect(res.val).toStrictEqual([12, 12]);
  });

  test("infix indentation", ({ expect }) => {
    const parser1 = P.succeed(P.Unit).getIndent();
    const res1 = P.run(parser1)("");
    expect(res1.val).toStrictEqual(0);

    const parser2 = P.succeed(P.Unit).getIndent().withIndent(3);
    const res2 = P.run(parser2)("");
    expect(res2.val).toStrictEqual(3);
  });
});

// KEYWORD

enum KeywordProblem {
  ExpectingLet = "ExpectingLet",
}

const keywordLet = P.run(
  P.keyword(P.Token("let", KeywordProblem.ExpectingLet))
);

advancedGroup("keyword", () => {
  test("Can parse a valid keyword", ({ expect }) => {
    const res = keywordLet("let");
    expect(res.ok).toBeTruthy();
  });
  test("Can not parse an invalid keyword", ({ expect }, value) => {
    //@ts-ignore
    const res = keywordLet(value);
    expect(res.err).toBeTruthy();
  }).with(["letter", "other"]);
});

// POSITION

const alphaNumParser = P.chompWhile((c) => Helpers.isAlphaNum(c) || c === "\n");

advancedGroup("getPosition", () => {
  const parser = P.run(alphaNumParser.andThen(() => P.getPosition));
  test("get correct position on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.val).toStrictEqual([1, 1]);
  });
  test("get correct position on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.val).toStrictEqual([1, 7]);
  });
  test("get correct position on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
    expect(res.val).toStrictEqual([3, 4]);
  });
});

advancedGroup("getRow", () => {
  const parser = P.run(alphaNumParser.andThen(() => P.getRow));
  test("get correct row on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.val).toStrictEqual(1);
  });
  test("get correct row on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.val).toStrictEqual(1);
  });
  test("get correct row on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
    expect(res.val).toStrictEqual(3);
  });
});
advancedGroup("getCol", () => {
  const parser = P.run(alphaNumParser.andThen(() => P.getCol));
  test("get correct column on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.val).toStrictEqual(1);
  });
  test("get correct column on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.val).toStrictEqual(7);
  });
  test("get correct column on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
    expect(res.val).toStrictEqual(4);
  });
});
advancedGroup("getOffset", () => {
  const parser = P.run(alphaNumParser.andThen(() => P.getOffset));
  test("get correct offset on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.val).toStrictEqual(0);
  });
  test("get correct offset on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.val).toStrictEqual(6);
  });
  test("get correct offset on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
    expect(res.val).toStrictEqual(8);
  });
});
advancedGroup("getSource", () => {
  const parser = P.run(alphaNumParser.andThen(() => P.getSource));
  test("get correct source on empty string", ({ expect }) => {
    const res = parser("");
    expect(res.val).toStrictEqual("");
  });
  test("get correct source on a line", ({ expect }) => {
    const res = parser("aaabbbå");
    expect(res.val).toStrictEqual("aaabbbå");
  });
  test("get correct source on multiple lines", ({ expect }) => {
    const res = parser("aaa\n\nbbbå");
    expect(res.val).toStrictEqual("aaa\n\nbbbå");
  });
});

// VARIABLES

const isLower = (s: string): boolean =>
  Helpers.isAlphaNum(s) && s.toLowerCase() === s;

const typeVar = P.variable({
  start: isLower,
  inner: (c) => Helpers.isAlphaNum(c) || c === "_",
  reserved: new Set(["let", "in", "case", "of"]),
  expecting: "ExpectedTypeVar",
});

advancedGroup("variable", () => {
  test("succeed on valid variable names", ({ expect }, val) => {
    //@ts-ignore
    const res = P.run(typeVar)(val);
    expect(res.val).toStrictEqual(val);
  }).with(["ok", "variable_names_are_great", "butThisWorks", "valid"]);

  test("succeed on valid valid part", ({ expect }, val) => {
    //@ts-ignore
    const res = P.run(typeVar)(val.test);
    //@ts-ignore
    expect(res.val).toStrictEqual(val.result);
  }).with([{ test: "valid-yes", result: "valid" }]);

  test("fail on invalid variable names", ({ expect }, val) => {
    //@ts-ignore
    const res = P.run(typeVar)(val);
    expectProblem(expect, res, ["ExpectedTypeVar"]);
  }).with(["Ok", "&hello", "_what", "åäö"]);

  test("fail on reserved names", ({ expect }, val) => {
    //@ts-ignore
    const res = P.run(typeVar)(val);
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

const intSet = (trailing: P.Trailing) =>
  P.sequence({
    start: P.Token("{", BlockProblem.LeftCurlyBrace),
    separator: P.Token(",", BlockProblem.Comma),
    end: P.Token("}", BlockProblem.RightCurlyBrace),
    spaces: P.spaces,
    item: P.int(BlockProblem.Int)(BlockProblem.Int),
    trailing: trailing,
  });

const intSetOptional = P.run(intSet(P.Trailing.Optional));
const intSetMandatory = P.run(intSet(P.Trailing.Mandatory));
const intSetForbidden = P.run(intSet(P.Trailing.Forbidden));

advancedGroup("sequence", () => {
  test("can parse a singel item", ({ expect }) => {
    const res = intSetOptional("{ 1337 \n}");
    expect(res.val).toStrictEqual(Immutable.List([1337]));
  });

  test("can parse multiple items", ({ expect }) => {
    const res = intSetOptional("{ 1337 \n, 12, 98,\n888}");
    expect(res.val).toStrictEqual(Immutable.List([1337, 12, 98, 888]));
  });

  test("will not parse incorrect items", ({ expect }) => {
    const res = intSetOptional("{ 1337 \n, 12.9, 98,\n888}");
    expect(res.err).toBeTruthy();
  });

  test("trailing seperator is optional", ({ expect }) => {
    const res1 = intSetOptional("{ 1337, \n}");
    expect(res1.val).toStrictEqual(Immutable.List([1337]));
    const res2 = intSetOptional("{ 1337 \n}");
    expect(res2.val).toStrictEqual(Immutable.List([1337]));
  });

  test("trailing seperator is mandatory", ({ expect }) => {
    const res1 = intSetMandatory("{ 1337, \n}");
    expect(res1.val).toStrictEqual(Immutable.List([1337]));
    const res2 = intSetMandatory("{ 1337 \n}");
    expect(res2.err).toBeTruthy();
  });

  test("trailing seperator is forbidden", ({ expect }) => {
    const res1 = intSetForbidden("{ 1337, \n}");
    expect(res1.err).toBeTruthy();
    const res2 = intSetForbidden("{ 1337 \n}");
    expect(res2.val).toStrictEqual(Immutable.List([1337]));
  });
});

// WHITESPACE

advancedGroup("spaces", () => {
  const parser = P.run(P.skip1st(P.spaces)(P.getOffset));
  test("Parse a space character", ({ expect }) => {
    const res = parser(" ");
    expect(res.val).toStrictEqual(1);
  });

  test("Parse a carriage return", ({ expect }) => {
    const res = parser("\r");
    expect(res.val).toStrictEqual(1);
  });

  test("Parse a new line", ({ expect }) => {
    const res = parser("\n");
    expect(res.val).toStrictEqual(1);
  });

  test("Parse multiple space characters", ({ expect }) => {
    const res = parser("\n   \r\n  ");
    expect(res.val).toStrictEqual(8);
  });

  test("Stop parsing when non-space characters appear", ({ expect }) => {
    const res = parser("\n   \r\n  asdasdasd");
    expect(res.val).toStrictEqual(8);
  });

  test("Can parse empty string", ({ expect }) => {
    const res = parser("");
    expect(res.val).toStrictEqual(0);
  });
});

// LINE COMMENT

enum SingleLineCommentProblem {
  NotLineComment = "NotLineComment",
}

const singleLineComment = P.run(
  P.lineComment(P.Token("//", SingleLineCommentProblem.NotLineComment)).andThen(
    () => P.getPosition
  )
);

advancedGroup("lineComment", () => {
  test("can parse a valid line comment", ({ expect }) => {
    const res = singleLineComment("// this is a comment");
    expect(res.ok).toBeTruthy();
  });

  test("only parses the line until newline", ({ expect }) => {
    const res = singleLineComment("// this is a comment\nsomething else");
    expect(res.val).toStrictEqual([2, 1]);
  });

  test("can not parse an invalid line comment", ({ expect }, value) => {
    //@ts-ignore
    const res = singleLineComment(value);
    expect(res.err).toBeTruthy();
  }).with(["/ this is a comment", " // this is a comment"]);
});

// MULTILINE COMMENT

enum MultiLineCommentProblem {
  NotOpenMultiLineComment = "NotOpenMultiLineComment",
  NotCloseMultiLineComment = "NotCloseMultiLineComment",
}

const multiLineComment = (nestable: P.Nestable) =>
  P.run(
    P.multiComment(
      P.Token("/*", MultiLineCommentProblem.NotOpenMultiLineComment)
    )(P.Token("*/", MultiLineCommentProblem.NotCloseMultiLineComment))(
      nestable
    ).andThen(() => P.getPosition)
  );

const nestableMulti = multiLineComment(P.Nestable.Nestable);
const notNestableMulti = multiLineComment(P.Nestable.NotNestable);

advancedGroup("multiComment", () => {
  test("Can parse a multiline comment on a singel line", ({ expect }) => {
    const res = nestableMulti("/*Can Be Parsed*/adsasd");
    expect(res.val).toStrictEqual([1, 18]);
  });
  test("Can parse a multiline comment across multiple lines", ({ expect }) => {
    const res = nestableMulti("/* \n Can \n Be \n Parsed \n */adsasd");
    expect(res.val).toStrictEqual([5, 4]);
  });

  test("Can parse a nested multiline comment on a singel line", ({
    expect,
  }) => {
    const res = nestableMulti("/*Can /*Be*/ Parsed*/adsasd");
    expect(res.val).toStrictEqual([1, 22]);
  });

  test("Can parse a nested multiline comment across multiple lines", ({
    expect,
  }) => {
    const res = nestableMulti("/* \n Can /* \n Be */ \n Parsed \n */adsasd");
    expect(res.val).toStrictEqual([5, 4]);
  });
});
