
import { MemoOptions, Owner, createMemo, onCleanup, runWithOwner } from "solid-js";
import { DisposableHandler } from "./disposable";
import { Notifier } from "../helper/notifier";
import { getGetter } from "../helper/util";
import { Cache } from "../helper/model";

/**
 * Like {@link DisposableHandler}, but memoizes getters.
 * The eventual getter contained in the {@link PropertyDescriptor} returned by the {@link getOwnPropertyDescriptor} trap will NOT be memoized, because memos are binded and a raw getter may be called by other means.
 * Getters are bound to the reactive object, so they'll be called without memoization if the current receiver is not the reactive proxy.
 * Changes on the raw object are not detected by the memos
 */
export class MemoHandler extends DisposableHandler {
	#cache: Cache<object> = Object.create(null);

    /**
     * Gets the {@link Cache} of a memoized object
     * @param obj The memoized object
     */
    static getCache<T extends object>(obj: T) { return this.getProxy(obj as MemoHandler).#cache as Cache<T>; }
    
    /**
     * -
     * If the property has a getter, it creates a binded memo on the {@link Cache} if necessary.
     * This does NOT return the value contained in {@link t} to avoid multiple executions of the getter, so the memos won't change when interacting with the raw object directly.
     * @inheritdoc
     */
    get<T extends object, K extends keyof T>(t: T, k: K, r: T) {
		const cache = MemoHandler.getCache(t);
        var f = cache[k];
        
        if (f === null && r === MemoHandler.getProxy(t)) // If the receiver is not the proxy it means that the current reactive object is the prototype of something else, in this case we can't use the memoized getters since they're bound to the proxy
            return super.get(t, k, r);
        
        if (!f) {
            const get = getGetter(t, k);
            if (!get) return cache[k] = null, super.get(t, k, r);
            f = this.memoize(t, k, get);
        }

        Notifier.track(MemoHandler.getStore(t), k);
        return f();
	}

    /**
     * -
     * Deletes the {@link k} property from {@link t}'s {@link Cache} IF there actually WAS a property
     * @inheritdoc
     */
	deleteProperty<T extends object, K extends keyof T>(t: T, k: K) {
		const own = Object.hasOwn(t, k);
        if (!super.deleteProperty(t, k)) return false;
        if (own) delete MemoHandler.getCache(t)[k];
        return true;
	}
    
    /**
     * -
     * Deletes the {@link k} property from {@link t}'s {@link Cache} IF {@link desc} is an accessor, otherwise it marks the property has not memoizable
     * @inheritdoc
     */
    defineProperty<T extends object, K extends keyof T>(t: T, k: K, desc: TypedPropertyDescriptor<T[K]>) {
        if (!super.defineProperty(t, k, desc)) return false;
        const cache = MemoHandler.getCache(t);
        if (desc.get || desc.set) delete cache[k];
        else cache[k] = null;
        return true;
	}

    /**
     * -
     * Deletes every NOT own property from {@link t}'s {@link Cache} IF the prototype actually changed
     * @inheritdoc
     */
	setPrototypeOf(t: object, proto: object | null, force = false) {
        if (!force && proto === Reflect.getPrototypeOf(t)) return true;
        const out = super.setPrototypeOf(t, proto, true);
        const store = MemoHandler.getStore(t), cache = MemoHandler.getCache(t);
        for (const k of Reflect.ownKeys(store) as (keyof typeof cache)[])
            if (!Object.hasOwn(t, k))
                delete cache[k];
        return out;
	}

    /**
     * Creates and saves a memo for a property.
     * Ensures that if the memo calls itself, {@link circular} will be used as fallback.
     * It saves the memo on {@link t}'s {@link Cache} and ensures it gets removed when its {@link Owner} gets disposed
     * @param t The object for which to create the memo
     * @param k The key of the property for which to create the memo
     * @param f The original getter of the property
     */
    memoize<T extends object, K extends keyof T>(t: T, k: K, f: (this: T) => T[K]) {
        const proxy = MemoHandler.getProxy(t);
        const owner = MemoHandler.getOwner(t);
        const cache = MemoHandler.getCache(t);
        const config: MemoOptions<T[K]> = { equals: (a, b) => this.compare(t, k, a, b) };
        cache[k] = () => this.circular(t, k, f);
        return cache[k] = runWithOwner(owner, () => {
            onCleanup(() => delete cache[k]);
            return createMemo(f.bind(proxy), undefined, config)
        })!;
    }

    /**
     * Provides a fallback value for when a getter calls itself while being memoized
     * @param _t The object containing the getter
     * @param _k The property containing the getter
     * @param _f The original getter of the property
     */
    circular<T extends object, K extends keyof T>(_t: T, _k: K, _f: (this: T) => T[K]) {
        return null as T[K];
    }
}