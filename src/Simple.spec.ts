import { test, Group } from "@japa/runner";
import * as P from "./Simple.js";
import * as Helpers from "./Helpers.js";
import { spaces } from "./Advanced.js";

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

const point: P.Parser<Point> = P.succeed(createPoint)
  .skip(P.symbol("("))
  .skip(P.spaces)
  .apply(P.float)
  .skip(P.symbol(","))
  .skip(P.spaces)
  .apply(P.float)
  .skip(P.spaces)
  .skip(P.symbol(")"));

parserGroup("Point", "@point-parser", () => {
  test("Succeed on '( 3, 4 )'", ({ expect }) => {
    expect(P.run(point)("( 3, 4 )").val).toStrictEqual({ x: 3, y: 4 });
  });

  test("Fail on '( 3. 4 )'", ({ expect }) => {
    const res = P.run(point)("( 3. 4 )");

    expect(res.err).toBeTruthy();

    if (res.err) {
      expect(res.val).toStrictEqual([
        { col: 5, problem: P.ExpectingSymbol(","), row: 1 },
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

const boolean: P.Parser<MyBoolean> = P.oneOf(
  P.succeed(MyTrue).skip(P.keyword("true")),
  P.succeed(MyFalse).skip(P.keyword("false")),
  P.succeed(MyOr)
    .skip(P.symbol("("))
    .skip(P.spaces)
    .apply(P.lazy(() => boolean))
    .skip(P.spaces)
    .skip(P.symbol("||"))
    .skip(P.spaces)
    .apply(P.lazy(() => boolean))
    .skip(P.spaces)
    .skip(P.symbol(")"))
);

parserGroup("Boolean", "@boolean-parser", () => {
  test("Succeed on true expressions", ({ expect }, value) => {
    const res = P.run(boolean)(value.toString());
    expect(res.ok).toBeTruthy();
    if (res.ok) {
      //@ts-ignore
      expect(res.val.equals(value)).toBeTruthy();
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

const json: P.Parser<Json> = P.oneOf(
  P.float.map(JNumber),
  P.keyword("true").map(() => JBoolean(true)),
  P.keyword("false").map(() => JBoolean(false)),
  P.keyword("null").map(() => JNull)
);

parserGroup("json", "@json-parser", () => {
  test("Succeed on 'number'", ({ expect }) => {
    const res = P.run(json)("1123.123");

    expect(res.ok).toBeTruthy();
  });

  test("Succeed on 'true'", ({ expect }) => {
    const res = P.run(json)("true");

    expect(res.ok).toBeTruthy();
  });

  test("Succeed on 'false'", ({ expect }) => {
    const res = P.run(json)("false");

    expect(res.ok).toBeTruthy();
  });
  test("Succeed on 'null'", ({ expect }) => {
    const res = P.run(json)("null");

    expect(res.ok).toBeTruthy();
  });
});

// US Zip Code

const checkZipCode = (code: string): P.Parser<string> => {
  if (code.length === 5) {
    return P.succeed(code);
  } else {
    return P.problem("a U.S. zip code has exactly 5 digits");
  }
};

const zipCode: P.Parser<string> = P.chompWhile(Helpers.isDigit)
  .getChompedString()
  .andThen(checkZipCode);

parserGroup("zipCode", "@zipCode-parser", () => {
  test("Succeed on '12345'", ({ expect }) => {
    expect(P.run(zipCode)("12345").val).toStrictEqual("12345");
  });

  test("Succeed on '00045'", ({ expect }) => {
    expect(P.run(zipCode)("00045").val).toStrictEqual("00045");
  });

  test("Fail on '123456'", ({ expect }) => {
    const res = P.run(zipCode)("123456");

    expect(res.err).toBeTruthy();
  });
  test("Fail on '012345'", ({ expect }) => {
    const res = P.run(zipCode)("012345");

    expect(res.err).toBeTruthy();
  });
});

// Token

const isVarChar = (char: string) => {
  return Helpers.isAlphaNum(char) || char === "_";
};

const checkEnding =
  (kwd: string) =>
  (isBadEnding: boolean): P.Parser<P.Unit> => {
    if (isBadEnding) {
      return P.problem("expecting the `" + kwd + "` keyword");
    } else {
      return P.commit(P.Unit);
    }
  };

const keyword = (kwd: string): P.Parser<P.Unit> => {
  return P.succeed((v: P.Unit) => v)
    .skip(P.backtrackable(P.token(kwd)))
    .keep(P.oneOf(P.backtrackable(P.chompIf(isVarChar)), P.succeed(false)))
    .andThen(checkEnding(kwd));
};

parserGroup("keyword", "@keyword-parser", () => {
  test("Succeed on correct keyword", ({ expect }, value) => {
    //@ts-ignore
    const res = P.run(keyword("let"))(value);
    expect(res.ok).toBeTruthy();
  }).with(["let"]);

  test("fail on incorrect keyword", ({ expect }, value) => {
    //@ts-ignore
    const res = P.run(keyword("let"))(value);
    expect(res.err).toBeTruthy();
  }).with(["llet"]);
});

// NUMBERS

type Number = IntE | FloatE;

class IntE {
  constructor(public readonly value: number) {}
}

class FloatE {
  constructor(public readonly value: number) {}
}
const elmNumber: P.Parser<Number> = P.number({
  int: (n) => new IntE(n),
  hex: (n) => new IntE(n), // 0x001A is allowed
  float: (n) => new FloatE(n),
});

parserGroup("elmNumber", "@elmNumber-parser", () => {
  test("Succeed on '123'", ({ expect }) => {
    const res = P.run(elmNumber)("123");
    expect(res.val).toStrictEqual(new IntE(123));
  });

  test("Succeed on '0x123abc'", ({ expect }) => {
    const res = P.run(elmNumber)("0x123abc");
    expect(res.val).toStrictEqual(new IntE(0x123abc));
  });

  test("Succeed on '123.123'", ({ expect }) => {
    const res = P.run(elmNumber)("123.123");
    expect(res.val).toStrictEqual(new FloatE(123.123));
  });

  test("fail on '0o1234'", ({ expect }, value) => {
    const res = P.run(elmNumber)("0o1234");
    expect(res.err).toBeTruthy;
  });
});

// END

const justAnInt: P.Parser<number> = P.succeed((n: number) => n)
  .apply(P.int)
  .skip(P.end);

parserGroup("justAnInt", "@justAnInt-parser", () => {
  test("Succeed on correct keyword", ({ expect }, value) => {
    //@ts-ignore
    const res = P.run(justAnInt)(value);
    expect(res.ok).toBeTruthy();
  }).with(["123"]);

  test("fail on incorrect int", ({ expect }, value) => {
    //@ts-ignore
    const res = P.run(justAnInt)(value);
    expect(res.err).toBeTruthy();
  }).with(["1 + 2"]);
});

// CHOMPED STRINGS

const php: P.Parser<string> = P.getChompedString(
  P.succeed(P.Unit)
    .skip(P.chompIf((c: string) => c === "$"))
    .skip(P.chompIf((c: string) => Helpers.isAlphaNum(c) || c === "_"))
    .skip(P.chompWhile((c: string) => Helpers.isAlphaNum(c) || c === "_"))
);

parserGroup("php", "@php-parser", () => {
  test("Succeed on '$_'", ({ expect }) => {
    const res = P.run(php)("$_");
    expect(res.ok).toBeTruthy();
  });
  test("Succeed on '$_asd'", ({ expect }) => {
    const res = P.run(php)("$_asd");
    expect(res.ok).toBeTruthy();
  });

  test("Fail on '$'", ({ expect }) => {
    const res = P.run(php)("$");
    expect(res.err).toBeTruthy();
  });
  test("Fail on 'asd'", ({ expect }) => {
    const res = P.run(php)("$");
    expect(res.err).toBeTruthy();
  });
});

const getChompedString = (parser: P.Parser<any>) => {
  return P.succeed(
    (from: number) => (to: number) => (str: string) => str.slice(from, to)
  )
    .apply(P.getOffset)
    .skip(parser)
    .apply(P.getOffset)
    .apply(P.getSource);
};

const mapChompedString =
  <A, B>(fn: (s: string, v: A) => B) =>
  (parser: P.Parser<A>): P.Parser<B> => {
    return P.succeed(
      (start: number) => (value: A) => (end: number) => (src: string) =>
        fn(src.slice(start, end), value)
    )
      .apply(P.getOffset)
      .apply(parser)
      .apply(P.getOffset)
      .apply(P.getSource);
  };

// CHOMP IF

const chompUpper: P.Parser<P.Unit> = P.chompIf(Helpers.isUpper);

parserGroup("chompUpper", "@chompUpper-parser", () => {
  test("Succeed on 'ABC'", ({ expect }) => {
    const res = P.run(chompUpper.getChompedString())("ABC");
    expect(res.val).toStrictEqual("A");
  });

  test("Fail on 'abc'", ({ expect }) => {
    const res = P.run(chompUpper)("abc");
    expect(res.err).toBeTruthy();
  });
});

// CHOMP WHILE

const whitespace: P.Parser<string> = P.chompWhile(
  (c: string) => c == " " || c == "\t" || c == "\n" || c == "\r"
).getChompedString();

parserGroup("whitespace", "@whitespace-parser", () => {
  test("Succeed on ' \\t\\n  a'", ({ expect }) => {
    const ws = " \t\n  ";
    const res = P.run(whitespace)(ws + "a");
    expect(res.val).toStrictEqual(ws);
  });

  test("Succeed on no whitespace", ({ expect }) => {
    const res = P.run(whitespace)("abc");
    expect(res.val).toStrictEqual("");
  });
});

const elmVar: P.Parser<string> = P.getChompedString(
  P.succeed(P.Unit)
    .skip(P.chompIf(Helpers.isLower))
    .skip(P.chompWhile((c: string) => Helpers.isAlphaNum(c) || c == "_"))
);

parserGroup("elmVar", "@elmVar-parser", () => {
  test("Succeed on 'avar'", ({ expect }) => {
    const res = P.run(elmVar)("avar");
    expect(res.val).toStrictEqual("avar");
  });

  test("Fail on 'Avar", ({ expect }) => {
    const res = P.run(elmVar)("Avar");
    expect(res.err).toBeTruthy();
  });
});

// CHOMP UNTIL

const comment: P.Parser<string> = P.symbol("{-")
  .skip(P.chompUntil("-}"))
  .getChompedString();

parserGroup("comment", "@comment-parser", () => {
  test("Succeed on '{- COMMENT -}'", ({ expect }) => {
    const res = P.run(comment)("{- COMMENT -}");
    expect(res.val).toStrictEqual("{- COMMENT -}");
  });

  test("Fail on '{- COMMENT", ({ expect }) => {
    const res = P.run(comment)("{- COMMENT");
    expect(res.err).toBeTruthy();
  });
});

// CHOMP UNTIL END OR

const singleLineComment: P.Parser<string> = P.symbol("--")
  .skip(P.chompUntilEndOr("\n"))
  .getChompedString();

parserGroup("singleLineComment", "@singleLineComment-parser", () => {
  test("Succeed on '-- COMMENT'", ({ expect }) => {
    const res = P.run(singleLineComment)("-- COMMENT");
    expect(res.val).toStrictEqual("-- COMMENT");
  });

  test("Succeed on '-- COMMENT\\n asdad'", ({ expect }) => {
    const res = P.run(singleLineComment)("-- COMMENT\n asdad");
    expect(res.val).toStrictEqual("-- COMMENT\n");
  });

  test("Succeed on '-- \\n asdad'", ({ expect }) => {
    const res = P.run(singleLineComment)("-- \n asdad");
    expect(res.val).toStrictEqual("-- \n");
  });

  test("Fail on '{- COMMENT", ({ expect }) => {
    const res = P.run(singleLineComment)("{- COMMENT");
    expect(res.err).toBeTruthy();
  });
});

// INDENTAION

const indentation = P.succeed((a: number) => (b: number) => [a, b])
  .apply(P.withIndent(4)(P.getIndent))
  .apply(P.getIndent);

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

const located = <A>(parser: P.Parser<A>): P.Parser<Located<A>> => {
  return P.succeed(Located<A>)
    .apply(P.getPosition)
    .apply(parser)
    .apply(P.getPosition);
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
  const parse = P.run(located(php));
  test("Succeed on '$_var'", ({ expect }) => {
    const res = parse("$_var");
    expect(res.val).toStrictEqual(Located([1, 1])("$_var")([1, 6]));
  });
});

// checkIndent

const checkIndent: P.Parser<P.Unit> = P.succeed(
  (indent: number) => (column: number) => indent < column
)
  .apply(P.getIndent)
  .apply(P.getCol)
  .andThen((isIdented) => {
    if (isIdented) {
      return P.succeed(P.Unit);
    } else {
      return P.problem("expecting more spaces");
    }
  });

parserGroup("checkIndent", "@checkIndent-parser", () => {
  test("Succeed when indendation is smaller or equal to col", ({ expect }) => {
    const res = P.run(checkIndent)("");
    expect(res.ok).toBeTruthy();
  });
  test("Fail when indentation is larger then col", ({ expect }) => {
    const res = P.run(
      P.succeed(P.Unit)
        .andThen(() => checkIndent)
        .withIndent(3)
    )("");
    expect(res.err).toBeTruthy();
  });
});

// Whitespace

const ifProgress =
  <A>(parser: P.Parser<A>) =>
  (offset: number): P.Parser<P.Step<number, P.Unit>> => {
    return P.succeed((x: A) => x)
      .skip(parser)
      .getOffset()
      .map((newOffset) =>
        offset === newOffset ? P.Done(P.Unit) : P.Loop(newOffset)
      );
  };

const elm: P.Parser<P.Unit> = P.loop(0)(
  ifProgress(
    P.oneOf(
      P.lineComment("--"),
      P.multiComment("{-")("-}")(P.Nestable.Nestable),
      P.spaces
    )
  )
);

parserGroup("elm-whitespace", "@elm-whitespace-parser", () => {
  const parse = P.run(elm.getChompedString());
  test("Succeed on empty string", ({ expect }) => {
    const res = parse("");
    expect(res.val).toStrictEqual("");
  });

  test("Succeed on with only white space string", ({ expect }) => {
    const arg = "\n\n    ";
    const res = parse(arg);
    expect(res.val).toStrictEqual(arg);
  });

  test("Succeed on line comment", ({ expect }) => {
    const arg = "\n\n  -- asjkdnasdn  \n";
    const res = parse(arg);
    expect(res.val).toStrictEqual(arg);
  });

  test("Succeed on multiline comment", ({ expect }) => {
    const arg = "\n\n  {- asjkdnasdn  /n -}";
    const res = parse(arg);
    expect(res.val).toStrictEqual(arg);
  });
});

const js: P.Parser<P.Unit> = P.loop(0)(
  ifProgress(
    P.oneOf(
      P.lineComment("//"),
      P.multiComment("/*")("*/")(P.Nestable.NotNestable),
      P.chompWhile((c) => c == " " || c == "\n" || c == "\r" || c == "\t")
    )
  )
);

parserGroup("js-whitespace", "@js-whitespace-parser", () => {
  const parse = P.run(js.getChompedString());
  test("Succeed on empty string", ({ expect }) => {
    const res = parse("");
    expect(res.val).toStrictEqual("");
  });

  test("Succeed on with only white space string", ({ expect }) => {
    const arg = "\t\n\n    ";
    const res = parse(arg);
    expect(res.val).toStrictEqual(arg);
  });

  test("Succeed on line comment", ({ expect }) => {
    const arg = "\t\n\n  // asjkdnasdn  \n";
    const res = parse(arg);
    expect(res.val).toStrictEqual(arg);
  });

  test("Succeed on multiline comment", ({ expect }) => {
    const arg = "\t\n\n  /* asjkdnasdn  /n */";
    const res = parse(arg);
    expect(res.val).toStrictEqual(arg);
  });
});

// Variable

const typeVar: P.Parser<string> = P.variable({
  start: Helpers.isLower,
  inner: (c: string) => Helpers.isAlphaNum(c) || c === "_",
  reserved: new Set(["let", "in", "case", "of"]),
});
