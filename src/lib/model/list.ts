
import { $TRACK, batch, For } from "solid-js";
import { ReactiveHandler } from "./reactive";
import { ForceTarget } from "../helper/type";

/** Cache that stores the batched version of each function */
const CACHE = new WeakMap<CallableFunction, CallableFunction>();

/**
 * Like {@link ReactiveHandler}, but also notifies {@link $TRACK} to make {@link Array}s work.
 * Also ensures that every function body is wrapped in a {@link batch} call.
 * Functions that are obtained through {@link getOwnPropertyDescriptor} will NOT be batched
 */
export class ListHandler extends ReactiveHandler {
    
    /**
     * -
     * If the returned value is a function, it wraps it using {@link ListHandler.batch}
     * @inheritdoc
     */
    get<T extends object, K extends keyof T>(t: T, k: K, r: T) {
        const out = super.get(t, k, r);
        return typeof out === "function" ? <T[K]>this.batch(t, k, <any>out) : out;
    }

    /**
	 * -
	 * Every time an own property of {@link t} is updated, it updates {@link $TRACK} too.
	 * Normal {@link Array}s in JavaScript are exotic objects, which means that they're different from regular objects even on the engine level, this is why "solid-js" relies on {@link $TRACK} to make them work.
	 * An example of a strange behavior of {@link Array}s is that methods like {@link Array.push} don't trigger some {@link ProxyHandler} traps, so we need to do it manually.
	 * Making a normal object with an {@link Array} prototype would fix most of the problems, but things like {@link For} wouldn't work because they rely EXCLUSIVELY on {@link $TRACK}
	 * @inheritdoc
	 */
    update<T extends object>(t: T, k: ForceTarget<T>, store = ListHandler.getStore(t)) {
        if (k === $TRACK || !Object.hasOwn(t, k)) return super.update(t, k, store);
        return batch(() => {
            const a = super.update(t, k, store);
            const b = super.update(t, $TRACK as ForceTarget<T>, store);
            return a || b; // (This is not done inline because we need to call both functions)
        });
    }

    /**
     * Wraps a function content in a {@link batch} call
     * @param _t The object from which the function was extracted
     * @param _k The key of the property containing the function
     * @param f The function itself
     */
    batch<T extends object, K extends keyof T, This, Args extends unknown[], R>(_t: T, _k: K, f: (this: This, ...args: Args) => R) {
        var temp = CACHE.get(f) as typeof f | undefined;
        if (!temp) CACHE.set(f, temp = function (this: This, ...args: Args): R { return batch(() => f.apply(this, args)); });
        return temp;
    }
}