
import { CircularGetterError, createUnownedMemo, getGetter } from "../helper/util";
import { MemoOptions, batch, createRenderEffect } from "solid-js";
import { ReactiveHandler } from "./reactive";
import { Cache } from "../helper/type";

/**
 * Like {@link ReactiveHandler}, but memoizes getters.
 * To avoid having to manually dispose the memoized proxy, each memo is created with {@link createUnownedMemo}.
 * The eventual getter contained in the {@link PropertyDescriptor} returned by the {@link getOwnPropertyDescriptor} trap will NOT be memoized, because memos are binded and a raw getter may be called by other means.
 * Getters are bound to the reactive object, so they'll be called without memoization if the current receiver is not the memoized proxy.
 * Changes on the raw object are not detected by the memos.
 * Here, {@link batch} is used to wait until the {@link Cache} is updated to fire the notifications fired by the base class
 */
export class MemoHandler extends ReactiveHandler {
	#cache: Cache<object> = Object.create(null);

    /**
     * Gets the {@link Cache} of a memoized object
     * @param obj The memoized object
     */
    static getCache<T extends object>(obj: T) { return this.getProxy(obj as MemoHandler).#cache as Cache<T>; }

    /**
     * Deletes the memo of a property and notifies its update, thus forcing the memo to be recreated
     * @param obj The object containing the property
     * @param k The key of the property
     * @returns Whether there was something to update
     */
    static resetMemo<T extends object>(obj: T, k: keyof T) {
        delete this.getCache(obj)[k];
        return this.prototype.update(obj, k);
    }

    /**
     * Reads a property under a reactive context to ensure that it gets memoized.
     * An effect is created to ensure that, if the memo of a property is changed, it will be read again
     * @param obj The object containing the property
     * @param k The key of the property
     */
    static ensureMemo<T extends object, K extends keyof T>(obj: T, k: K) {
        createRenderEffect<Cache<T>[K]>(last => {
            this.prototype.track(obj, k);
            const memo = this.getCache(obj)[k];
            if (memo && memo !== last) memo();
            return memo;
        });
    }
    
    /**
     * -
     * If the property has a getter, it creates a binded memo on the {@link Cache} if necessary.
     * This does NOT return the value contained in {@link t} to avoid multiple executions of the getter, so the memos won't change when interacting with the raw object directly.
     * @inheritdoc
     */
    get<T extends object, K extends keyof T>(t: T, k: K, r: T) {
		const cache = MemoHandler.getCache(t);
        var f = cache[k];
        
        if (f === null || r !== MemoHandler.getProxy(t)) // If the receiver is not the proxy it means that the current memoized object is the prototype of something else, in this case we can't use the memoized getters since they're bound to the proxy
            return super.get(t, k, r);
        
        if (!f) {
            const get = getGetter(t, k);
            if (!get) return cache[k] = null, super.get(t, k, r);
            f = this.memoize(t, k, get);
        }

        this.track(t, k);
        return f();
	}

    /**
     * -
     * Deletes the {@link k} property from {@link t}'s {@link Cache} IF there actually WAS a property
     * @inheritdoc
     */
	deleteProperty<T extends object, K extends keyof T>(t: T, k: K) {
		const own = Object.hasOwn(t, k); // Only things that are "own" get actually deleted, although the operation returns `true` anyway
        return batch(() => {
            if (!super.deleteProperty(t, k)) return false;
            if (own) delete MemoHandler.getCache(t)[k];
            return true;
        });
	}
    
    /**
     * -
     * Deletes the {@link k} property from {@link t}'s {@link Cache} IF {@link desc} has a getter, otherwise it marks the property has not memoizable
     * @inheritdoc
     */
    defineProperty<T extends object, K extends keyof T>(t: T, k: K, desc: TypedPropertyDescriptor<T[K]>) {
        return batch(() => {
            if (!super.defineProperty(t, k, desc)) return false;
            const cache = MemoHandler.getCache(t);
            if (desc.get) delete cache[k];
            else cache[k] = null;
            return true;
        });
	}

    /**
     * -
     * Deletes every NOT own property from {@link t}'s {@link Cache} IF the prototype actually changed
     * @inheritdoc
     */
	setPrototypeOf(t: object, proto: object | null, force = false) {
        if (!force && proto === Reflect.getPrototypeOf(t)) return true;
        return batch(() => {
            const out = super.setPrototypeOf(t, proto, true);
            const store = MemoHandler.getStore(t), cache = MemoHandler.getCache(t);
            for (const k of Reflect.ownKeys(store) as (keyof typeof cache)[])
                if (!Object.hasOwn(t, k))
                    delete cache[k];
            return out;
        });
	}

    /**
     * Creates a memo for a property and saves it on {@link t}'s {@link Cache}.
     * Ensures that if the memo calls itself, {@link circular} will be used as fallback
     * @param t The object containing the property
     * @param k The key of the property
     * @param f The original getter of the property
     */
    memoize<T extends object, K extends keyof T>(t: T, k: K, f: (this: T) => T[K]) {
        const proxy = MemoHandler.getProxy(t);
        const cache = MemoHandler.getCache(t);
        const config: MemoOptions<T[K]> = { name: this.tag(t, k), equals: (a, b) => this.compare(t, k, a, b) };
        cache[k] = () => this.circular(t, k, f);
        return cache[k] = createUnownedMemo(f.bind(proxy), config);
    }

    /**
     * Provides a fallback value for when a getter calls itself while being memoized
     * @param t The object containing the getter
     * @param k The property containing the getter
     * @param _f The original getter of the property
     */
    circular<T extends object, K extends keyof T>(t: T, k: K, _f: (this: T) => T[K]): T[K] {
        throw new CircularGetterError(`The ${JSON.stringify(this.tag(t, k))} getter called itself while being memoized`);
    }
}