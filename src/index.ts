/**
 * If you are new to this library, please take a look at {@link Simple:namespace | simple module}.
 * It is a simple wrapper around the {@link Advanced:namespace | advanced module} that hides some of the
 * complexity. You do not have to worry about having to reqrite any of your code. They are both fully compatible.
 *
 * @remarks
 * I created this library because I wanted a type safe parser combinator library
 * like Haskell's {@link https://hackage.haskell.org/package/parsec parsec}
 * or Elm's {@link https://package.elm-lang.org/packages/elm/parser/ parser library}.
 *
 * @see {@link https://en.wikipedia.org/wiki/Parser_combinator Parser Combinator}
 *
 * @packageDocumentation
 */

/**
 * This module is a wrapper around the {@link Advanced:namespace | advanced module}
 * and makes a couple of choices for you. It has already defined a
 * {@link Simple!Problem | problem type} to use and there are also a couple of other
 * simplifications.
 *
 * If you want to define your own problem type from scratch and start
 * capturing the context a parser is in when it fails head over to the {@link Advanced:namespace | advanced module}.
 */
export * as Simple from "./Simple.js";

/**
 * The advanced module gives you full access to specifing your own problems and
 * contexts. Fantastic if you want to create even better error messages.
 * If you want a simpler API head over to the {@link Simple:namespace | simple module}.
 */
export * as Advanced from "./Advanced.js";

/**
 * The Helper module contains utility functions that are used in both the {@link Advanced:namespace | advanced}
 * and {@link Simple:namespace | simple} modules.
 *
 * Feel free to use them when you are writing your own parsers :)
 */
export * as Helpers from "./Helpers.js";
