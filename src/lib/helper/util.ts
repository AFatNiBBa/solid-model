
import { Accessor, MemoOptions, getOwner, createRoot, createMemo, onCleanup, Owner, batch, createSignal, EffectFunction, getListener } from "solid-js";
import { Computation } from "solid-js/types/reactive/signal.js";

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
 * It uses {@link createBatchableMemo} to ensure that the memo gets cached before the first time it gets read, so that if the unowned memo is read by itself, the internal native memo doesn't get created more than once.
 * It is actualy likely that memos read themselves, this is due to the complicated algorithms that **"solid-js"** uses to ensure each memo has the correct value, for more informations, check [this](https://github.com/solidjs/solid/discussions/2489) discussion.
 * These algorithms are also the reason why I couldn't simply throw when the memo is read by itself, it's not always wrong when that happens
 * @param f The function to memoize
 * @param opts The options to pass down to {@link createMemo}
 */
export function createUnownedMemo<T>(f: Accessor<T>, opts?: MemoOptions<T>): Accessor<T> {
    var count = 0, disp: (() => void) | undefined, memo: Accessor<T> | undefined;
    return () => {
        if (!getOwner()) return (memo ? memo : f)();
        if (!memo) batch(() => [ disp, memo ] = createRoot(d => [ d, createMemo(f, undefined, opts) ])); // Defers the execution AT LEAST until after the cache has been set (It will be deferred longer if there's another batch outside of the function)
        count++;
        onCleanup(() => --count || (disp!(), memo = disp = undefined));
        return memo!();
    };
}

/**
 * Like {@link createMemo} but allows the user to defer even the first execution of {@link fn} by using {@link batch}.
 * If the memo is read before the end of the {@link batch} call, {@link fn} will be executed at that moment.
 * It's useful when you need the memoized {@link Accessor} before user-provided code ({@link fn}) has the possibility to do anything nasty.
 * This function's body is wrapped in {@link batch} so that there's always at least a batching in progress, which prevents the re-execution from happening before the memo's creation has ended.
 * The initial value, which I return in the first (Fake) execution, wouldn't have replaced the re-execution's result even if the latter happened immediately (Before), all thanks to {@link Computation.updatedAt}, which seems to be missing from **"@solidjs/signals"**, so I batched anyway just in case
 * @param fn a function that receives its previous or the initial value, if set, and returns a new value used to react on a computation
 * @param value an optional initial value for the computation; if set, fn will never receive undefined as first argument
 * @param options allows to set a name in dev mode for debugging purposes and use a custom comparison function in equals
 */
export function createBatchableMemo<Next extends Prev, Prev = Next>(fn: EffectFunction<undefined | NoInfer<Prev>, Next>): Accessor<Next>;
export function createBatchableMemo<Next extends Prev, Init = Next, Prev = Next>(fn: EffectFunction<Init | Prev, Next>, value: Init, options?: MemoOptions<Next>): Accessor<Next>;
export function createBatchableMemo<Next extends Prev, Init, Prev>(fn: EffectFunction<Init | Prev, Next>, value?: Init, options?: MemoOptions<Next>): Accessor<Next> {
	return batch(() => {
		return createMemo(prev => {
            getListener()!.fn = fn;
            const [ track, update ] = createSignal(undefined, { internal: true, equals: false });
            track();    // Tracks the temporary signal
            update();   // Runs the current memo again according to the current batch (Since there's always at least a batch, the memo won't be re-executed immediately)
            return prev as Next;
        }, value, options);
	});
}