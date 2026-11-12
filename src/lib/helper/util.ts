
import { Accessor, MemoOptions, DEV, getObserver, getOwner, onCleanup, createRoot, createMemo, runWithOwner, Owner } from "@solidjs/signals";

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
 * The memoization happens only if the result has been read from at least one {@link Owner} that is currently active, otherwise {@link f} is called directly (Unless the internal native memo already exists, in which case it gets read).
 * The internal native memo is created inside a detached root, and it's disposed only when nothing keeps it alive anymore:
 * - Untracked reads from an {@link Owner} keep it alive until that {@link Owner} gets cleaned up (Through {@link onOwnerCleanup})
 * - Tracked reads keep it alive until it loses its last observer (Through {@link MemoOptions.unobserved}, which, unlike {@link onCleanup}, also works inside scopes that forbid children like `createTrackedEffect()`)
 *
 * If the unowned memo is read by itself during the internal native memo creation, the latter will NOT be created more than once by calling {@link f} directly.
 * If the memo actually reads itself AFTER the memoization, it will fallback to the default behaviour of **"solid-js"**.
 * Since the internal native memo can only be created during reads, it's likely unrelated to the {@link Owner} hierarchy that created it, so I'm making sure it doesn't keep any reference to the latter
 * @param f The function to memoize
 * @param opts The options to pass down to {@link createMemo}
 */
export function createUnownedMemo<T>(f: Accessor<T>, opts?: MemoOptions<T>): Accessor<T> {
    var count = 0, observed = false, disp: (() => void) | undefined, memo: Accessor<T> | undefined | null;
    const tryDispose = () => {
        if (count || observed || !disp) return;
        const d = disp;
        memo = disp = undefined;
        d();
    };
    const unobserved = () => {
        observed = false;
        tryDispose();
        opts?.unobserved?.();
    };
    return () => {
        if (memo === null) return f();
        const observer = getObserver();
        if (!observer && !getOwner()) return (memo ?? f)();
        if (!memo) {
            memo = null;
            try { [ disp, memo ] = runWithOwner(null, () => createRoot(d => [ d, createMemo(f, { ...opts, unobserved }) ] as const)); }
            catch (err) { throw memo = undefined, err; }
        }
        if (observer) observed = true; // The read below subscribes the observer, so `unobserved()` will be called once every observer is gone
        else if (onOwnerCleanup(() => (count--, tryDispose()))) count++;
        else return tryDispose(), (memo ?? f)(); // Nothing can keep the memo alive (It gets disposed only if nothing else is keeping it alive)
        return memo!();
    };
}

/**
 * Like {@link onCleanup}, but also works inside scopes that forbid it, like `createTrackedEffect()` and `onSettled()`.
 * In production builds {@link onCleanup} doesn't check the scope, so the cleanup gets registered on the current {@link Owner} directly.
 * In development builds the check throws instead, so the cleanup gets registered on the nearest ancestor that accepts it (Found through {@link DEV}), which lives at least as long as the current {@link Owner}
 * @param fn The function to call when the {@link Owner} gets cleaned up
 * @returns Whether the cleanup has been registered
 */
function onOwnerCleanup(fn: () => void) {
    for (let owner = getOwner(); owner; owner = DEV?.getParent(owner) ?? null) {
        try { return runWithOwner(owner, () => onCleanup(fn)), true; }
        catch (err) { if (!DEV) throw err; }
    }
    return false;
}
