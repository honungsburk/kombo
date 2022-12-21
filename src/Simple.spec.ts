import { test, Group } from "@japa/runner";
import * as P from "./Simple.js";
import * as Helpers from "./Helpers.js";

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

type MyBoolean = typeof MyTrue | typeof MyFalse | MyOr;

const MyTrue = {
  kind: "MyTrue",
} as const;

const MyFalse = {
  kind: "MyFalse",
} as const;

type MyOr = {
  readonly kind: "MyOr";
  readonly l: MyBoolean;
  readonly r: MyBoolean;
};

const MyOr =
  (l: MyBoolean) =>
  (r: MyBoolean): MyOr => ({
    kind: "MyOr",
    l,
    r,
  });

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

// const keyword = (kwd: string): P.Parser<P.Unit> {
//   return P.succeed(v => v)
//     .skip(P.backtrackable(P.token(kwd)))
//     .keep(P.oneOf(
//       P.backtrackable(P.chompIf(isVarCar)),
//       P.succeed(false)
//     )).andThen(checkEnding(kwd))
// }

// const checkEnding = (kwd: string) => (isBadEnding: boolean): Parser<P.Unit> => {
//   if(isBadEnding){
//     return P.problem("expecting the `" + kwd + "` keyword")
//   } else {
//     return P.
//   }
// }

// keyword : String -> Parser ()
// keyword kwd =
//   succeed identity
//     |. backtrackable (token kwd)
//     |= oneOf
//         [ map (\_ -> True) (backtrackable (chompIf isVarChar))
//         , succeed False
//         ]
//     |> andThen (checkEnding kwd)
// checkEnding : String -> Bool -> Parser ()
// checkEnding kwd isBadEnding =
//   if isBadEnding then
//     problem ("expecting the `" ++ kwd ++ "` keyword")
//   else
//     commit ()
// isVarChar : Char -> Bool
// isVarChar char =
//   Char.isAlphaNum char || char == '_'

// LOOPS

// TODO: Write a parser for a simple programming language

// type Stmt = string;

// const statement: P.Parser<Stmt> = P.succeed(().skip();

// // Note that we are useing a mutable list here. Dangerous but OK in this scenario.
// const statementsHelp = (stmts: Stmt[]): P.Parser<P.Step<Stmt[], Stmt[]>> => {
//   return P.oneOf(
//     P.succeed((stmt: Stmt) => {
//       stmts.push(stmt);
//       return new P.Loop(stmts);
//     })
//       .keep(statement)
//       .skip(P.spaces)
//       .skip(P.symbol(";"))
//       .skip(P.spaces),
//     P.succeed(P.Unit).map(() => new P.Done(stmts))
//   );
// };

// const statements: P.Parser<Stmt[]> = P.loop([])(statementsHelp);

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

// END

const justAnInt: P.Parser<number> = P.succeed((n: number) => n)
  .apply(P.int)
  .skip(P.end);

// CHOMPED STRINGS

// TODO: Add a postfix operator!
const php: P.Parser<string> = P.getChompedString(
  P.succeed(P.Unit)
    .skip(P.chompIf((c: string) => c === "$"))
    .skip(P.chompIf((c: string) => Helpers.isAlphaNum(c) || c === "_"))
    .skip(P.chompWhile((c: string) => Helpers.isAlphaNum(c) || c === "_"))
);

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

// CHOMP WHILE

const whitespace: P.Parser<P.Unit> = P.chompWhile(
  (c: string) => c == " " || c == "\t" || c == "\n" || c == "\r"
);

const elmVar: P.Parser<string> = P.getChompedString(
  P.succeed(P.Unit).skip(
    P.chompIf(Helpers.isLower).skip(
      P.chompWhile((c: string) => Helpers.isAlphaNum(c) || c == "_")
    )
  )
);

// CHOMP UNTIL

const comment: P.Parser<P.Unit> = P.symbol("{-").skip(P.chompUntil("-}"));

// CHOMP UNTIL END OR

const singleLineComment: P.Parser<P.Unit> = P.symbol("--").skip(
  P.chompUntilEndOr("\n")
);

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

// checkIndent

const checkIndent: P.Parser<P.Unit> = P.succeed(
  (indent: number) => (column: number) => indent <= column
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
      P.lineComment("//"),
      P.multiComment("/*")("*/")(P.Nestable.Nestable),
      P.spaces
    )
  )
);

const js: P.Parser<P.Unit> = P.loop(0)(
  ifProgress(
    P.oneOf(
      P.lineComment("//"),
      P.multiComment("/*")("*/")(P.Nestable.NotNestable),
      P.chompWhile((c) => c == " " || c == "\n" || c == "\r" || c == "\t")
    )
  )
);

// elm : Parser ()
// elm =
//   loop 0 <| ifProgress <|
//     oneOf
//       [ lineComment "--"
//       , multiComment "{-" "-}" Nestable
//       , spaces
//       ]

// js : Parser ()
// js =
//   loop 0 <| ifProgress <|
//     oneOf
//       [ lineComment "//"
//       , multiComment "/*" "*/" NotNestable
//       , chompWhile (\c -> c == ' ' || c == '\n' || c == '\r' || c == '\t')
//       ]

// ifProgress : Parser a -> Int -> Parser (Step Int ())
// ifProgress parser offset =
//   succeed identity
//     |. parser
//     |= getOffset
//     |> map (\newOffset -> if offset == newOffset then Done () else Loop newOffset)
