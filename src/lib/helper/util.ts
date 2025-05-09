
import { Accessor, MemoOptions, getOwner, createRoot, createMemo, onCleanup, Owner } from "solid-js";

/** Type of the error thrown when a getter calls itself while being memoized */
export class CircularGetterError extends Error { }

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

/**
 * Like {@link createMemo}, but doesn't need an {@link Owner}.
 * The memo is disposed without the need of an {@link Owner} by delegating its disposal to the {@link Owner}s that read it.
 * The memoization happens only if the result has been read from at least one {@link Owner} that is currently active
 * @param f The function to memoize
 * @param opts The options to pass down to {@link createMemo}
 * @param fallback The function to call if the memo is being read by itself
 */
export function createUnownedMemo<T>(f: Accessor<T>, opts?: MemoOptions<T>, fallback?: Accessor<T>): Accessor<T> {
    var count = 0, running = false, memo: Accessor<T> | undefined, disp: (() => void) | undefined;
    return () => {
        if (running) 
            if (fallback) return fallback();
            else throw new CircularGetterError("The memo is being read by itself");
        running = true;
        try
        {
            if (!getOwner()) return (memo ? memo : f)();
            memo ??= createRoot(d => (disp = d, createMemo(f, undefined, opts)));
            count++;
            onCleanup(() => --count || (disp!(), memo = disp = undefined));
            return memo();
        }
        finally { running = false; }
    };
}