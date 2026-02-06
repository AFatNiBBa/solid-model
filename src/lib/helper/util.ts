
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
 * If the memo actually reads itself AFTER the memoization, it will fallback to the default behaviour: It will succeed if all the iterations converge to the same value and it will throw otherwise.
 * Since the internal native memo can only be created during reads, it's likely unrelated to the {@link Owner} hierarchy that created it, so I'm making sure it doesn't keep any reference to the latter.
 * If the internal native memo had retained a reference to the calling hierarchy, it could have triggered [this](https://github.com/solidjs/solid/blob/90ba0286b0dbc7802113bf5874687c9032d66969/packages/solid/src/reactive/signal.ts#L1511) part of the complicated algorithm that **"solid-js"** uses to ensure each memo has the correct value.
 * The purpose of that part of the algorithm is likely to prevent child memos from updating unnecessarily when their parent ones would have been updated anyway shortly after (Thus disposing their children).
 * Since the unowned memo is logically disconnected from the calling hierarchy, there's no reason for that part of the algorithm to run in our case.
 * If I allowed that part of the algorithm to run anyway, it would have made it likely for memos to read themselves (For more informations check [this](https://github.com/solidjs/solid/discussions/2489) discussion), which is why I initially couldn't just throw an error when the memo is read by itself, since it wasn't always wrong when that happened.
 * Since the only reason I care at all about the circular reads is just to prevent messing up the caching of the internal native memo, I decided not to re-introduce the error even if I could safely throw it as of now
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
            try { [ disp, memo ] = createRoot(d => [ d, createMemo(f, undefined, opts) ], null); }
            catch (err) { throw memo = undefined, err; }
        }
        count++;
        onCleanup(() => --count || (disp!(), memo = disp = undefined));
        return memo();
    };
}