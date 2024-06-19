
import { MemoOptions, createMemo, onCleanup, runWithOwner } from "solid-js";
import { accessorToAtom, getGetter } from "../util";
import { ReactiveHandler, Store } from "./reactive";
import { DisposableHandler } from "./disposable";
import { Atom, ReadOnlyAtom } from "../atom";
import { BaseHandler } from "./base";

/**
 * Like {@link DisposableHandler}, but memoizes getters.
 * The eventual getter contained in the {@link PropertyDescriptor} returned by the {@link getOwnPropertyDescriptor} trap will NOT be memoized, because memos are binded and a raw getter may be called by other means.
 * Getters are bound to the reactive object, so they'll be called without memoization if the current receiver is not the reactive proxy.
 * Changes on the raw object are not detected by the memos
 */
export class MemoHandler extends DisposableHandler {

    constructor(target: object, proxy: object) {
        super(target, proxy);
        runWithOwner(DisposableHandler.getOwner(this), () => {
            onCleanup(() => {
                const store = ReactiveHandler.getStore(this);
                for (const k of Reflect.ownKeys(store) as (keyof typeof store)[])
                    if (!(store[k] instanceof Atom))
                        delete store[k];
            });
        });
    }

    /**
     * -
     * If the property has a getter, it creates a binded memo on the {@link Store} if necessary.
     * This does NOT return the value contained in {@link t} to avoid multiple executions of the getter, so the memos won't change when interacting with the raw object directly.
     * @inheritdoc
     */
    get<T extends object, K extends keyof T>(t: T, k: K, r: T) {
        const store = ReactiveHandler.getStore(t);
        const proxy = BaseHandler.getProxy(t);
        const temp = store[k]; //                  (↓ This breaks this ↓)
        if (temp && (r === proxy || temp instanceof Atom)) return temp.value as T[K];       // If the receiver is not the proxy it means that the current reactive object is the prototype of something else, in this case we can't use the memoized getters since they're bound to the proxy
        reactive: if (temp === undefined) {
            const get = getGetter(t, k);
            if (get)
                if (r !== proxy) break reactive;                                            // Getters won't even be memoized if the current receiver is not the proxy
                else return createAndSaveMemo(this, store, t, k, get).value;
            var desc: PropertyDescriptor | undefined;
            if (!(k in t) || (desc = Object.getOwnPropertyDescriptor(t, k)) && !desc.set)   // If this line gets executed I'm sure there's no getter, so I don't need to check
                return (store[k] = this.createAtom(t, k, desc?.value)).value;
            store[k] = null;
        }
        return Reflect.get(t, k, r);
    }

    /**
     * -
     * If the property has a getter, it creates a binded memo on the {@link Store} if necessary
     * @inheritdoc
     */
    defineProperty<T extends object, K extends keyof T>(t: T, k: K, desc: TypedPropertyDescriptor<T[K]>): boolean {
        const store = ReactiveHandler.getStore(t);
        if (desc.get) createAndSaveMemo(this, store, t, k, desc.get);
        else store[k] = desc.set ? null : this.createAtom(t, k, desc.value!);
        return Reflect.defineProperty(t, k, desc);
    }

    /**
     * Creates a memo that is supposed to end up in the {@link Store} of {@link t}
     * @param t The object for which to create the memo
     * @param k The key of the property for which to create the memo
     * @param f The original getter of the property
     */
    createMemo<T extends object, K extends keyof T>(t: T, k: K, f: (this: T) => T[K]): ReadOnlyAtom<T[K]> {
        const proxy = BaseHandler.getProxy(t);
        const opts: MemoOptions<T[K]> = { name: this.getPropertyTag(t, k), equals: this.getComparator(t, k) };
        const memo = runWithOwner(DisposableHandler.getOwner(proxy), () => createMemo(f.bind(proxy), undefined, opts))!;
        return accessorToAtom(memo, ReadOnlyAtom<T[K]>);
    }
}

/**
 * Wrapper around {@link MemoHandler.createMemo} that handles circular references inside getters.
 * Ensures that if the memo calls itself it won't be created multiple times by setting its slot on {@link store} to `null`.
 * It saves the memo on {@link store}
 * @param handler The current proxy handler that's being used
 * @param store The {@link Signal} store on which to save the newly created memo
 * @param t The object for which to create the memo
 * @param k The key of the property for which to create the memo
 * @param f The original getter of the property
 */
function createAndSaveMemo<T extends object, K extends keyof T>(handler: MemoHandler, store: Store<T>, t: T, k: K, f: (this: T) => T[K]) {
    store[k] = null;
    return store[k] = handler.createMemo(t, k, f);
}