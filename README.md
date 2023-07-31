> **_NOTE:_** This is a port of Elm's [Parser Combinators library](https://package.elm-lang.org/packages/elm/parser/latest/Parser) to typescript. This includes large part of the documentation

# Kombo

Regular expressions are quite confusing and difficult to use.
This library provides a coherent alternative that handles more cases and produces clearer code.

The particular goals of this library are:

- Make writing parsers as simple and fun as possible.
- Produce excellent error messages.
- Go pretty fast.
- Works with CommonJS and ESM. Browser or node.

## Installation

```bash
npm install @honungsburk/kombo
```

## Parser Pipelines

To parse a 2D point like `"( 3, 4 )"`, you might create a point parser like this:

```ts
import {
  Parser,
  succeed,
  symbol,
  float,
  spaces,
} from "@honungsburk/kombo/Simple";

type Point = {
  x: number;
  y: number;
};

const point: Parser<Point> = succeed((x: number) => (y: number) => {
  x, y;
})
  .skip(symbol("("))
  .skip(spaces)
  .apply(float)
  .skip(spaces)
  .skip(symbol(","))
  .skip(spaces)
  .apply(float)
  .skip(spaces)
  .skip(symbol(")"));

// Running the parser returns a Result wrapper that can either be OK or Err
const pointResult = point.run("( 123.09, 23.123)");

// If it is Ok the parsing succeeded
if (pointResult.isOk) {
  console.log("x:", pointResult.value.x);
  console.log("y:", pointResult.value.y);
}

// If there was an error can deal with it accordingly
if(pointResult.isErr){
  ...
}

```

All the interesting stuff is happening in point. It uses two operators:

- `skip` means “parse this, but ignore the result”
- `apply` means “parse this, and apply the result to the function”

So the `point` function only gets the result of the two `float` parsers.

I recommend having one line per operator in your parser pipeline. If you need multiple lines for some reason, use a let or make a helper function.

If you want to have look at a larger example head over to the [Kombo-Json repository](https://github.com/honungsburk/kombo-json), and if you still feel unsure you can clone the [Kombo Workshop repository](https://github.com/honungsburk/kombo-workshop) and
go through the exercises.

## Backtracking

To make fast parsers with precise error messages, all of the parsers in this package do not backtrack by default. Once you start going down a path, you keep going down it.

This is nice in a string like `[ 1, 23zm5, 3 ]` where you want the error at the `z`. If we had backtracking by default, you might get the error on `[` instead. That is way less specific and harder to fix!

So the defaults are nice, but sometimes the easiest way to write a parser is to look ahead a bit and see what is going to happen. It is definitely more costly to do this, but it can be handy if there is no other way. This is the role of [`backtrackable`](https://example.com#backtrackable) parsers. Check out the [semantics](https://github.com/honungsburk/kombo/blob/master/semantics.md) page for more details!

## Tracking Context

Most parsers tell you the row and column of the problem:

```text
Something went wrong at (4:17)
```

That may be true, but it is not how humans think. It is how text editors think! It would be better to say:

```text
I found a problem with this list:

      [ 1, 23zm5, 3 ]
           ^

I wanted an integer, like 6 or 90219.
```

Notice that the error messages says `this list`. That is context! That is the language my brain speaks, not rows and columns.

Once you get comfortable with the [`Simple`](https://frankhampusweslien.com/kombo/modules/Simple.html) module, you can switch over to [`Advanced`](https://frankhampusweslien.com/kombo/modules/Advanced.html) and use [`inContext`](https://frankhampusweslien.com/kombo/functions/Advanced.inContext.html) to track exactly what your parser thinks it is doing at the moment. You can let the parser know “I am trying to parse a `"list"` right now” so if an error happens anywhere in that context, you get the hand annotation!

This technique is used by the parser in the Elm compiler to give more helpful error messages.

## FAQ

### Why did you name this library _Kombo_?

This is a parser _combinator_ library, and the Swedish word for _combo_ is , you guessed it, _kombo_.

### Do you have any large examples on how to build a real parser using Kombo?

Checkout the [Kombo JSON Parser](https://github.com/honungsburk/kombo-json)

### I still don't know how to use it!

Don't fret! Clone the [Kombo Workshop repository](https://github.com/honungsburk/kombo-workshop) and
go through the exercises.

## Links

- [Comparison with Prior Work](https://github.com/honungsburk/kombo/blob/master/comparison.md)
- [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
- [Kombo docs](https://honungsburk.github.io/kombo)
- [github](https://github.com/honungsburk/kombo)
- [npm](https://github.com/honungsburk/kombo)
- [personal website](https://honungsburk.github.io/)
