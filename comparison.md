## Comparison with Prior Work

> **NOTE** This text was orginally written by [
> Evan Czaplicki](https://github.com/evancz) and has since been adopted to typescript.

I have not seen the [parser pipeline][1] or the [context stack][2] ideas in other libraries, but [backtracking][3] relate to prior work.

[1]: README.md#parser-pipelines
[2]: README.md#tracking-context
[3]: README.md#backtracking

Most parser combinator libraries I have seen are based on Haskell’s Parsec library, which has primitives named `try` and `lookAhead`. I believe [`backtrackable`][backtrackable] is a better primitive for two reasons.

[backtrackable]: https://example.com#backtrackable

### Performance and Composition

Say we want to create a precise error message for `length [1,,3]`. The naive approach with Haskell’s Parsec library produces very bad error messages:

```haskell
spaceThenArg :: Parser Expr
spaceThenArg =
  try (spaces >> term)
```

This means we get a precise error from `term`, but then throw it away and say something went wrong at the space before the `[`. Very confusing! To improve quality, we must write something like this:

```haskell
spaceThenArg :: Parser Expr
spaceThenArg =
  choice
    [ do  lookAhead (spaces >> char '[')
          spaces
          term
    , try (spaces >> term)
    ]
```

Notice that we parse `spaces` twice no matter what.

Notice that we also had to hardcode `[` in the `lookAhead`. What if we update `term` to parse records that start with `{` as well? To get good commits on records, we must remember to update `lookAhead` to look for `oneOf "[{"`. Implementation details are leaking out of `term`!

With `backtrackable` in this Typescript library, you can just say:

```ts
const spaceThenArg: Parser<Expr> = succeed((x) => x)
  .skip(backtrackable(spaces))
  .take(term);
```

It does less work, and is more reliable as `term` evolves. I believe the presence of `backtrackable` means that `lookAhead` is no longer needed.

### Expressiveness

You can define `try` in terms of [`backtrackable`][backtrackable] like this:

```ts
const try = <A>(parser: Parser<A>): Parser<A> => {
  return succeed(x => x)
    .take(backtrackable(parser))
    .skip(commit(unit))
}
```

No expressiveness is lost!

So while it is possible to define `try`, I left it out of the public API. In practice, `try` often leads to “bad commits” where your parser fails in a very specific way, but you then backtrack to a less specific error message. I considered naming it `allOrNothing` to better explain how it changes commit behavior, but ultimately, I thought it was best to encourage users to express their parsers with `backtrackable` directly.

### Summary

Compared to previous work, `backtrackable` lets you produce precise error messages **more efficiently**. By thinking about “backtracking behavior” directly, you also end up with **cleaner composition** of parsers. And these benefits come **without any loss of expressiveness**.
