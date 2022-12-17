/**
 * If you are new to this library, please take a look at {@link Simple:namespace | simple module}.
 * It is a simple wrapper around the {@link Advanced:namespace | advanced module} that hides some of the
 * complexity. You do not have to worry about having to reqrite any of your code. They are both fully compatible.
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
