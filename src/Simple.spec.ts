import { test, Group } from "@japa/runner";
import * as S from "./Simple.js";
import * as P from "./Parser.js";
import * as Helpers from "./Helpers.js";
import * as Results from "./Result.js";

function parserGroup(
  parserName: string,
  tag: `@${string}-parser`,
  callback: (group: Group) => void
) {
  test.group(parserName, (group) => {
    group.tap((test) =>
      test.tags(["@unit", "@pure", "@index", "@parser", tag])
    );
    callback(group);
  });
}

// Point
type Point = {
  x: number;
  y: number;
};

const createPoint =
  (x: number) =>
  (y: number): Point => ({ x, y });

const point: S.Parser<Point> = S.succeed(createPoint)
  .skip(S.symbol("("))
  .skip(S.spaces)
  .apply(S.float)
  .skip(S.symbol(","))
  .skip(S.spaces)
  .apply(S.float)
  .skip(S.spaces)
  .skip(S.symbol(")"));

parserGroup("Point", "@point-parser", () => {
  test("Succeed on '( 3, 4 )'", async ({ expect }) => {
    const res = await S.run(point)("( 3, 4 )");
    expect(res.value).toStrictEqual({ x: 3, y: 4 });
  });

  test("Fail on '( 3. 4 )'", async ({ expect }) => {
    const res = await S.run(point)("( 3. 4 )");

    expect(Results.isErr(res)).toBeTruthy();

    if (Results.isErr(res)) {
      expect(res.value).toStrictEqual([
        { col: 5, problem: S.ExpectingSymbol(","), row: 1 },
      ]);
    }
  });
});

// Boolean

type MyBoolean = {
  readonly kind: string;
  equals(other: MyBoolean): boolean;
  toString(): string;
};

const MyTrue: MyBoolean = {
  kind: "MyTrue",
  equals: (other: MyBoolean): boolean => {
    return other.kind === "MyTrue";
  },
  toString: () => {
    return "true";
  },
} as const;

const MyFalse: MyBoolean = {
  kind: "MyFalse",
  equals: (other: MyBoolean): boolean => {
    return other.kind === "MyFalse";
  },
  toString: () => {
    return "false";
  },
} as const;

function isMyOr(x: MyBoolean): x is MyOrImpl {
  return x.kind === "MyOr";
}

class MyOrImpl implements MyBoolean {
  public readonly kind = "MyOr";
  constructor(public readonly l: MyBoolean, public readonly r: MyBoolean) {}

  equals(other: MyBoolean): boolean {
    if (isMyOr(other)) {
      return this.l.equals(other.l) && this.r.equals(other.r);
    }
    return false;
  }
  toString() {
    return `(${this.l.toString()} || ${this.r.toString()})`;
  }
}

const MyOr =
  (l: MyBoolean) =>
  (r: MyBoolean): MyBoolean =>
    new MyOrImpl(l, r);

const boolean: S.Parser<MyBoolean> = S.oneOf(
  S.succeed(MyTrue).skip(S.keyword("true")),
  S.succeed(MyFalse).skip(S.keyword("false")),
  S.succeed(MyOr)
    .skip(S.symbol("("))
    .skip(S.spaces)
    .apply(S.lazy(() => boolean))
    .skip(S.spaces)
    .skip(S.symbol("||"))
    .skip(S.spaces)
    .apply(S.lazy(() => boolean))
    .skip(S.spaces)
    .skip(S.symbol(")"))
);

parserGroup("Boolean", "@boolean-parser", () => {
  test("Succeed on true expressions", async ({ expect }, value) => {
    const res = await S.run(boolean)(value.toString());
    expect(Results.isOk(res)).toBeTruthy();
    if (Results.isOk(res)) {
      expect(res.value.equals(value as any as MyBoolean)).toBeTruthy();
    }
  }).with([
    MyTrue,
    MyFalse,
    MyOr(MyFalse)(MyTrue),
    MyOr(MyFalse)(MyOr(MyFalse)(MyTrue)),
  ]);
});

// JSON

type Json =
  | ReturnType<typeof JNumber>
  | ReturnType<typeof JBoolean>
  | typeof JNull;

const JNumber = (n: number) =>
  ({
    kind: "JNumber",
    value: n,
  } as const);

const JBoolean = (b: boolean) =>
  ({
    kind: "JBoolean",
    value: b,
  } as const);

const JNull = {
  kind: "JNull",
} as const;

const json: S.Parser<Json> = S.oneOf(
  S.float.map(JNumber),
  S.keyword("true").map(() => JBoolean(true)),
  S.keyword("false").map(() => JBoolean(false)),
  S.keyword("null").map(() => JNull)
);

parserGroup("json", "@json-parser", () => {
  test("Succeed on 'number'", async ({ expect }) => {
    const res = await S.run(json)("1123.123");

    expect(Results.isOk(res)).toBeTruthy();
  });

  test("Succeed on 'true'", async ({ expect }) => {
    const res = await S.run(json)("true");

    expect(Results.isOk(res)).toBeTruthy();
  });

  test("Succeed on 'false'", async ({ expect }) => {
    const res = await S.run(json)("false");

    expect(Results.isOk(res)).toBeTruthy();
  });
  test("Succeed on 'null'", async ({ expect }) => {
    const res = await S.run(json)("null");

    expect(Results.isOk(res)).toBeTruthy();
  });
});

// US Zip Code

const checkZipCode = (code: string): S.Parser<string> => {
  if (code.length === 5) {
    return S.succeed(code);
  } else {
    return S.problem("a U.S. zip code has exactly 5 digits");
  }
};

const zipCode: S.Parser<string> = S.chompWhile(Helpers.isDigit)
  .getChompedChunk()
  .andThen(checkZipCode);

parserGroup("zipCode", "@zipCode-parser", () => {
  test("Succeed on '12345'", async ({ expect }) => {
    const src = await zipCode.run("12345");
    expect(src.value).toStrictEqual("12345");
  });

  test("Succeed on '00045'", async ({ expect }) => {
    const src = await zipCode.run("00045");
    expect(src.value).toStrictEqual("00045");
  });

  test("Fail on '123456'", async ({ expect }) => {
    const res = await zipCode.run("123456");

    expect(Results.isErr(res)).toBeTruthy();
  });
  test("Fail on '012345'", async ({ expect }) => {
    const res = await zipCode.run("012345");

    expect(Results.isErr(res)).toBeTruthy();
  });
});

// NUMBERS

type Number = IntE | FloatE;

class IntE {
  constructor(public readonly value: number) {}
}

class FloatE {
  constructor(public readonly value: number) {}
}
const elmNumber: S.Parser<Number> = S.number({
  int: (n) => new IntE(n),
  hex: (n) => new IntE(n), // 0x001A is allowed
  float: (n) => new FloatE(n),
});

parserGroup("elmNumber", "@elmNumber-parser", () => {
  test("Succeed on '123'", async ({ expect }) => {
    const res = await elmNumber.run("123");
    expect(res.value).toStrictEqual(new IntE(123));
  });

  test("Succeed on '0x123abc'", async ({ expect }) => {
    const res = await elmNumber.run("0x123abc");
    expect(res.value).toStrictEqual(new IntE(0x123abc));
  });

  test("Succeed on '123.123'", async ({ expect }) => {
    const res = await elmNumber.run("123.123");
    expect(res.value).toStrictEqual(new FloatE(123.123));
  });

  test("fail on '0o1234'", async ({ expect }, value) => {
    const res = await elmNumber.run("0o1234");
    expect(Results.isErr(res)).toBeTruthy;
  });
});

// END

const justAnInt: S.Parser<number> = S.succeed((n: number) => n)
  .apply(S.int)
  .skip(S.end);

parserGroup("justAnInt", "@justAnInt-parser", () => {
  test("Succeed on correct keyword", async ({ expect }) => {
    const res = await S.run(justAnInt)("123");
    expect(Results.isOk(res)).toBeTruthy();
  }).with(["123"]);

  test("fail on incorrect int", async ({ expect }) => {
    const res = await S.run(justAnInt)("1 + 2");
    expect(Results.isErr(res)).toBeTruthy();
  }).with([]);
});

// CHOMPED STRINGS

const php: S.Parser<string> = S.getChompedString(
  S.succeed(P.Unit)
    .skip(S.chompIf((c: string) => c === "$"))
    .skip(S.chompIf((c: string) => Helpers.isAlphaNum(c) || c === "_"))
    .skip(S.chompWhile((c: string) => Helpers.isAlphaNum(c) || c === "_"))
);

parserGroup("php", "@php-parser", () => {
  test("Succeed on '$_'", async ({ expect }) => {
    const res = await php.run("$_");
    expect(Results.isOk(res)).toBeTruthy();
  });
  test("Succeed on '$_asd'", async ({ expect }) => {
    const res = await php.run("$_asd");
    expect(Results.isOk(res)).toBeTruthy();
  });

  test("Fail on '$'", async ({ expect }) => {
    const res = await php.run("$");
    expect(Results.isErr(res)).toBeTruthy();
  });
  test("Fail on 'asd'", async ({ expect }) => {
    const res = await php.run("asd");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

const getChompedString = (parser: S.Parser<any>) => {
  return S.succeed(
    (from: number) => (to: number) => (str: string) => str.slice(from, to)
  )
    .apply(S.getOffset)
    .skip(parser)
    .apply(S.getOffset)
    .apply(S.getSource);
};

const mapChompedString =
  <A, B>(fn: (s: string, v: A) => B) =>
  (parser: S.Parser<A>): S.Parser<B> => {
    return S.succeed(
      (start: number) => (value: A) => (end: number) => (src: string) =>
        fn(src.slice(start, end), value)
    )
      .apply(S.getOffset)
      .apply(parser)
      .apply(S.getOffset)
      .apply(S.getSource);
  };

// CHOMP IF

const chompUpper: S.Parser<P.Unit> = S.chompIf(Helpers.isUpper);

parserGroup("chompUpper", "@chompUpper-parser", () => {
  test("Succeed on 'ABC'", async ({ expect }) => {
    const res = await chompUpper.getChompedChunk().run("ABC");
    expect(res.value).toStrictEqual("A");
  });

  test("Fail on 'abc'", async ({ expect }) => {
    const res = await S.run(chompUpper)("abc");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

// CHOMP WHILE

const whitespace: S.Parser<string> = S.chompWhile(
  (c: string) => c == " " || c == "\t" || c == "\n" || c == "\r"
).getChompedChunk();

parserGroup("whitespace", "@whitespace-parser", () => {
  test("Succeed on ' \\t\\n  a'", async ({ expect }) => {
    const ws = " \t\n  ";
    const res = await whitespace.run(ws + "a");
    expect(res.value).toStrictEqual(ws);
  });

  test("Succeed on no whitespace", async ({ expect }) => {
    const res = await whitespace.run("abc");
    expect(res.value).toStrictEqual("");
  });
});

const elmVar: S.Parser<string> = S.getChompedString(
  S.succeed(P.Unit)
    .skip(S.chompIf(Helpers.isLower))
    .skip(S.chompWhile((c: string) => Helpers.isAlphaNum(c) || c == "_"))
);

parserGroup("elmVar", "@elmVar-parser", () => {
  test("Succeed on 'avar'", async ({ expect }) => {
    const res = await elmVar.run("avar");
    expect(res.value).toStrictEqual("avar");
  });

  test("Fail on 'Avar", async ({ expect }) => {
    const res = await elmVar.run("Avar");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

// CHOMP UNTIL

const comment: S.Parser<string> = S.symbol("{-")
  .skip(S.chompUntil("-}"))
  .getChompedChunk();

parserGroup("comment", "@comment-parser", () => {
  test("Succeed on '{- COMMENT -}'", async ({ expect }) => {
    const res = await comment.run("{- COMMENT -}");
    expect(res.value).toStrictEqual("{- COMMENT -}");
  });

  test("Fail on '{- COMMENT", async ({ expect }) => {
    const res = await comment.run("{- COMMENT");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

// CHOMP UNTIL END OR

const singleLineComment: S.Parser<string> = S.symbol("--")
  .skip(S.chompUntilEndOr("\n"))
  .getChompedChunk();

parserGroup("singleLineComment", "@singleLineComment-parser", () => {
  test("Succeed on '-- COMMENT'", async ({ expect }) => {
    const res = await singleLineComment.run("-- COMMENT");
    expect(res.value).toStrictEqual("-- COMMENT");
  });

  test("Succeed on '-- COMMENT\\n asdad'", async ({ expect }) => {
    const res = await singleLineComment.run("-- COMMENT\n asdad");
    expect(res.value).toStrictEqual("-- COMMENT\n");
  });

  test("Succeed on '-- \\n asdad'", async ({ expect }) => {
    const res = await singleLineComment.run("-- \n asdad");
    expect(res.value).toStrictEqual("-- \n");
  });

  test("Fail on '{- COMMENT", async ({ expect }) => {
    const res = await singleLineComment.run("{- COMMENT");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

// INDENTAION

const indentation = S.succeed((a: number) => (b: number) => [a, b])
  .apply(S.withIndent(4)(S.getIndent))
  .apply(S.getIndent);

// Location

type Located<A> = {
  start: [number, number];
  value: A;
  end: [number, number];
};

const Located =
  <A>(start: [number, number]) =>
  (value: A) =>
  (end: [number, number]): Located<A> => ({
    start: start,
    value: value,
    end: end,
  });

const located = <A>(parser: S.Parser<A>): S.Parser<Located<A>> => {
  return S.succeed(Located<A>)
    .apply(S.getPosition)
    .apply(parser)
    .apply(S.getPosition);
};

function toUnderlineChar(
  minCol: number,
  maxCol: number,
  col: number,
  char: string
): string {
  if (minCol <= col && col <= maxCol) {
    return "^";
  } else if (char === "\t") {
    return "\t";
  } else {
    return " ";
  }
}

function makeUnderline(row: string, minCol: number, maxCol: number): string {
  const listOfChars: string[] = [...row];
  const underline: string[] = listOfChars.map((char, index) =>
    toUnderlineChar(minCol, maxCol, index, char)
  );
  return underline.join("");
}

parserGroup("located", "@located-parser", () => {
  const parse = S.run(located(php));
  test("Succeed on '$_var'", async ({ expect }) => {
    const res = await parse("$_var");
    expect(res.value).toStrictEqual(Located([1, 1])("$_var")([1, 6]));
  });
});

// checkIndent

const checkIndent: S.Parser<P.Unit> = S.succeed(
  (indent: number) => (column: number) => indent < column
)
  .apply(S.getIndent)
  .apply(S.getCol)
  .andThen((isIdented) => {
    if (isIdented) {
      return S.succeed(P.Unit);
    } else {
      return S.problem("expecting more spaces");
    }
  });

parserGroup("checkIndent", "@checkIndent-parser", () => {
  test("Succeed when indendation is smaller or equal to col", async ({
    expect,
  }) => {
    const res = await S.run(checkIndent)("");
    expect(Results.isOk(res)).toBeTruthy();
  });
  test("Fail when indentation is larger then col", async ({ expect }) => {
    const res = await S.run(
      S.succeed(P.Unit)
        .andThen(() => checkIndent)
        .withIndent(3)
    )("");
    expect(Results.isErr(res)).toBeTruthy();
  });
});

// Whitespace

const ifProgress =
  <A>(parser: S.Parser<A>) =>
  (offset: number): S.Parser<S.Step<number, P.Unit>> => {
    return S.succeed((x: A) => x)
      .skip(parser)
      .getOffset()
      .map((newOffset) =>
        offset === newOffset ? S.Done(P.Unit) : S.Loop(newOffset)
      );
  };

const elm: S.Parser<P.Unit> = S.loop(0)(
  ifProgress(
    S.oneOf(
      S.lineComment("--"),
      S.multiComment("{-")("-}")(S.Nestable.Nestable),
      S.spaces
    )
  )
);

parserGroup("elm-whitespace", "@elm-whitespace-parser", () => {
  const parse = S.run(elm.getChompedChunk());
  test("Succeed on empty string", async ({ expect }) => {
    const res = await parse("");
    expect(res.value).toStrictEqual("");
  });

  test("Succeed on with only white space string", async ({ expect }) => {
    const arg = "\n\n    ";
    const res = await parse(arg);
    expect(res.value).toStrictEqual(arg);
  });

  test("Succeed on line comment", async ({ expect }) => {
    const arg = "\n\n  -- asjkdnasdn  \n";
    const res = await parse(arg);
    expect(res.value).toStrictEqual(arg);
  });

  test("Succeed on multiline comment", async ({ expect }) => {
    const arg = "\n\n  {- asjkdnasdn  /n -}";
    const res = await parse(arg);
    expect(res.value).toStrictEqual(arg);
  });
});

const js: S.Parser<P.Unit> = S.loop(0)(
  ifProgress(
    S.oneOf(
      S.lineComment("//"),
      S.multiComment("/*")("*/")(S.Nestable.NotNestable),
      S.chompWhile((c) => c == " " || c == "\n" || c == "\r" || c == "\t")
    )
  )
);

parserGroup("js-whitespace", "@js-whitespace-parser", () => {
  const parse = S.run(js.getChompedChunk());
  test("Succeed on empty string", async ({ expect }) => {
    const res = await parse("");
    expect(res.value).toStrictEqual("");
  });

  test("Succeed on with only white space string", async ({ expect }) => {
    const arg = "\t\n\n    ";
    const res = await parse(arg);
    expect(res.value).toStrictEqual(arg);
  });

  test("Succeed on line comment", async ({ expect }) => {
    const arg = "\t\n\n  // asjkdnasdn  \n";
    const res = await parse(arg);
    expect(res.value).toStrictEqual(arg);
  });

  test("Succeed on multiline comment", async ({ expect }) => {
    const arg = "\t\n\n  /* asjkdnasdn  /n */";
    const res = await parse(arg);
    expect(res.value).toStrictEqual(arg);
  });
});

// Variable

const typeVar: S.Parser<string> = S.variable({
  start: Helpers.isLower,
  inner: (c: string) => Helpers.isAlphaNum(c) || c === "_",
  reserved: new Set(["let", "in", "case", "of"]),
});

// Many

// This parser parses an int and then all of the spaces after it.
const int = S.number({ int: (n) => n }).skip(S.spaces);
// We then repeat that parser zero or more times.
const ints: S.Parser<number[]> = S.many(int);
const ints1: S.Parser<number[]> = S.many1(int);
