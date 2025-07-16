
import { Accessor, MemoOptions, getOwner, createRoot, createMemo, onCleanup, Owner } from "solid-js";

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
 * The memoization happens only if the result has been read from at least one {@link Owner} that is currently active.
 * If the unowned memo is read by itself during the internal native memo creation, the latter will NOT be created more than once by calling {@link f} directly.
 * It is actualy likely that memos read themselves, this is due to the complicated algorithms that **"solid-js"** uses to ensure each memo has the correct value, for more informations, check [this](https://github.com/solidjs/solid/discussions/2489) discussion.
 * These algorithms are also the reason why I couldn't simply throw when the memo is read by itself, it's not always wrong when that happens
 * @param f The function to memoize
 * @param opts The options to pass down to {@link createMemo}
 */
export function createUnownedMemo<T>(f: Accessor<T>, opts?: MemoOptions<T>): Accessor<T> {
    var count = 0, disp: (() => void) | undefined, memo: Accessor<T> | undefined | null;
    return () => {
        if (memo === null) return f();
        if (!getOwner()) return (memo ? memo : f)();
        if (!memo) {
            memo = null;
            try { [ disp, memo ] = createRoot(d => [ d, createMemo(f, undefined, opts) ]); }
            catch (err) { throw memo = undefined, err; }
        }
        count++;
        onCleanup(() => --count || (disp!(), memo = disp = undefined));
        return memo();
    };
}