
import { MemoOptions, Signal, createMemo, runWithOwner } from "solid-js";
import { accessorToAtom, getGetter } from "../util";
import { DisposableHandler } from "./disposable";
import { Atom, ReadOnlyAtom } from "../atom";
import { ReactiveHandler } from "./reactive";
import { TargetHandler } from "./base";

/**
 * Like {@link SignalHandler}, but memoizes getters.
 * The eventual getter contained in the {@link PropertyDescriptor} returned by the {@link getOwnPropertyDescriptor} trap will NOT be memoized, because memos are binded and a raw getter may be called by other means.
 * Getters are bound to the reactive object, so they'll be called without memoization if the current receiver is not the reactive proxy.
 * Changes on the raw object are not detected by the memos
 */
export class MemoHandler extends DisposableHandler {
    /**
     * -
     * If the property has a getter, it creates a binded memo on the {@link Signal} store if necessary.
     * This does NOT return the value contained in {@link t} to avoid multiple executions of the getter, so the memos won't change when interacting with the raw object directly.
     * @inheritdoc
     */
    get<T extends object, K extends keyof T>(t: T, k: K, r: T) {
        const store = ReactiveHandler.getStore(t)
        const proxy = TargetHandler.getProxy(t);
        const temp = store[k];
        if (temp && (r === proxy || temp instanceof Atom)) return temp.value;               // If the receiver is not the proxy it means that the current reactive object is the prototype of something else, in this case we can't use the memoized getters since they're bound to the proxy
        reactive: if (temp === undefined) {
            const get = getGetter(t, k);
            if (get)
                if (r !== proxy) break reactive;                                            // Getters won't even be memoized if the current receiver is not the proxy
                else return (store[k] = this.createMemo(t, k, get)).value;
            var desc: PropertyDescriptor | undefined;
            if (!(k in t) || (desc = Object.getOwnPropertyDescriptor(t, k)) && !desc.set)   // If this line gets executed I'm sure there's no getter, so I don't need to check
                return (store[k] = this.createAtom(t, k, desc?.value)).value;
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
        const store = ReactiveHandler.getStore(t);
        if (desc.get) store[k] = this.createMemo(t, k, desc.get);
        else store[k] = desc.set ? null : this.createAtom(t, k, desc.value!);
        return Reflect.defineProperty(t, k, desc);
    }

    /**
     * Creates a memo that is supposed to end up in the {@link Signal} store of {@link t}
     * @param t The object for which to create the memo
     * @param k The key of the property for which to create the memo
     * @param f The original getter of the property
     */
    createMemo<T extends object, K extends keyof T>(t: T, k: K, f: (this: T) => T[K]): ReadOnlyAtom<T[K]> {
        const proxy = TargetHandler.getProxy(t);
        const opts: MemoOptions<T[K]> = { name: this.getPropertyTag(t, k), equals: this.getComparator(t, k) };
        const memo = runWithOwner(DisposableHandler.getOwner(proxy), () => createMemo(f.bind(proxy), undefined, opts))!;
        return accessorToAtom(memo, ReadOnlyAtom<T[K]>);
    }
}