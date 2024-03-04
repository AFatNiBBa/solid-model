
import { MemoOptions, Signal, createMemo, runWithOwner } from "solid-js";
import { IProperty, Reactive, Store } from "../data";
import { SignalHandler } from "./signal";

/**
 * Gets the eventual getter of a property across the prototype chain using the fast deprecated method {@link Object.prototype.__lookupGetter__}
 * @param obj Object from which to get the getter
 * @param k Key of the property that may have a getter
 */
export const getGetter = Function.prototype.call.bind((<any>Object.prototype).__lookupGetter__) as <T, K extends keyof T>(obj: T, k: K) => (() => T[K]) | undefined;

/**
 * Like {@link SignalHandler}, but memoizes getters.
 * The eventual getter contained in the {@link PropertyDescriptor} returned by the {@link getOwnPropertyDescriptor} trap will NOT be memoized, because memos are binded and a raw getter may be called by other means.
 * Getters are bound to the reactive object, so they'll be called without memoization if the current receiver is not the reactive proxy.
 * Changes on the raw object are not detected by the memos
 */
export class MemoHandler extends SignalHandler {
    /**
     * -
     * If the property has a getter, it creates a binded memo on the {@link Signal} store if necessary.
     * This does NOT return the value contained in {@link t} to avoid multiple executions of the getter, so the memos won't change when interacting with the raw object directly.
     * @inheritdoc
     */
    get<T extends object, K extends keyof T>(t: T, k: K, r: T) {
        const store = Reactive.getStore(t);
        const temp = store[k];
        if (temp && (temp.set || r === Reactive.getProxy(t))) return temp();                // If the receiver is not the proxy it means that the current reactive object is the prototype of something else, in this case we can't use the memoized getters since they're bound to the proxy
        reactive: if (temp === undefined) {
            const get = getGetter(t, k);
            if (get)
                if (r !== Reactive.getProxy(t)) break reactive;                             // Getters won't even be memoized if the current receiver is not the proxy
                else return createAndSaveMemo(this, store, t, k, get)();
            var desc: PropertyDescriptor | undefined;
            if (!(k in t) || (desc = Object.getOwnPropertyDescriptor(t, k)) && !desc.set)   // If this line gets executed I'm sure there's no getter, so I don't need to check
                return (store[k] = this.createSignal(t, k, desc?.value))();
            store[k] = null;
        }
        return Reflect.get(t, k, r);
    }

    /**
     * -
     * If the property has a getter, it creates a binded memo on the {@link Signal} store if necessary
     * @inheritdoc
     */
    defineProperty<T extends object, K extends keyof T>(t: T, k: K, desc: TypedPropertyDescriptor<T[K]>): boolean {
        const store = Reactive.getStore(t);
        if (desc.get) createAndSaveMemo(this, store, t, k, desc.get);
        else store[k] = desc.set ? null : this.createSignal(t, k, desc.value!);
        return Reflect.defineProperty(t, k, desc);
    }

    /**
     * Creates a memo that is supposed to end up in the {@link Signal} store of {@link t}
     * @param t The object for which to create the memo
     * @param k The key of the property for which to create the memo
     * @param f The original getter of the property
     */
    createMemo<T extends object, K extends keyof T>(t: T, k: K, f: (this: T) => T[K]): IProperty<T[K]> {
        const proxy = Reactive.getProxy(t);
        const opts: MemoOptions<T[K]> = { name: this.getPropertyTag(t, k), equals: (a, b) => this.compareChange(t, k, a, b) };
        return runWithOwner(Reactive.getOwner(proxy), () => createMemo(f.bind(proxy), undefined, opts))!;
    }

    /**
     * Function that gets called when a getter calls itself during its initial memoization
     * @param t The object for which the memo is being created
     * @param k The key of the property for which the memo is being created
     * @param f The original getter of the property
     */
    onCircular<T extends object, K extends keyof T>(t: T, k: K, f: (this: T) => T[K]) {
        return f.call(Reactive.getProxy(t));
    }
}

/**
 * Wrapper around {@link MemoHandler.createMemo} that handles circular references inside getters.
 * It calls {@link MemoHandler.onCircular} in case of recursion.
 * It saves the memo on {@link store}
 * @param handler The current proxy handler that's being used
 * @param store The {@link Signal} store on which to save the newly created memo
 * @param t The object for which to create the memo
 * @param k The key of the property for which to create the memo
 * @param f The original getter of the property
 */
function createAndSaveMemo<T extends object, K extends keyof T>(handler: MemoHandler, store: Store<T>, t: T, k: K, f: (this: T) => T[K]) {
    store[k] = () => handler.onCircular(t, k, f);
    return store[k] = handler.createMemo(t, k, f);
}