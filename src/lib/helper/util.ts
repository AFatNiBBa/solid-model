
/** Type of the error thrown when a getter calls itself while being memoized */
export class CircularGetterError extends Error { }

/**
 * Class that returns whatever was passed to it.
 * Used to dynamically attach private fields to objects
 */
export class Identity { constructor(obj: object) { return obj; } }

/**
 * A collection of symbols that each represents an internal of an object.
 * They're used to track/notify changes to those internals
 */
export namespace Internal {
    export const IS_EXTENSIBLE = Symbol("[[IsExtensible]]");
    export const PROTO = Symbol("[[Prototype]]");
    export const SHAPE = Symbol("[[Shape]]");
}

/**
 * Makes an instance function static.
 * It creates a function that behaves like {@link Function.call} of {@link f}.
 * Example:
 * ```js
 * f.call(a, b);
 * staticCall(f)(a, b);
 * ```
 * @param f The function to make static
 */
export const staticCall = <T, Args extends readonly unknown[], R>(f: (this: T, ...args: Args) => R) => Function.prototype.call.bind(f) as (x: T, ...args: Args) => R;

/**
 * Gets the eventual getter of a property across the prototype chain using the fast deprecated method {@link Object.prototype.__lookupGetter__}
 * @param obj Object from which to get the getter
 * @param k Key of the property that may have a getter
 */
export const getGetter = staticCall((<any>Object.prototype).__lookupGetter__ as <T, K extends keyof T>(this: T, k: K) => { (): T[K] } | undefined);