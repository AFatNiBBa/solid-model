
import { batch, createSignal, equalFn, getListener, onCleanup, untrack } from "solid-js";
import { Forcer, ForceTarget, Internal, Store } from "../helper/type";
import { BaseHandler } from "./base";

/** Handler that gives simple reactivity to arbitrary objects */
export class ReactiveHandler extends BaseHandler implements ProxyHandler<object> {
	#store: Store<object> = Object.create(null);    
    
    /**
     * Gets the {@link Store} of a reactive object
     * @param obj The reactive object
     */
    static getStore<T extends object>(obj: T) { return this.getProxy(obj as ReactiveHandler).#store as Store<T>; }

    /**
     * -
     * Tracks the {@link k} property
     * @inheritdoc
     */
    get<T extends object, K extends keyof T>(t: T, k: K, r: T): T[K] {
		const out = Reflect.get(t, k, r);
		this.track(t, k);
		return out;
	}

	/**
     * -
     * Calls {@link Reflect.set} ensuring nothing is tracked.
	 * In some cases, the ECMAScript specification requires the {@link set} trap to call {@link getOwnPropertyDescriptor} and/or {@link defineProperty}, this means that:
	 * 1) We do not need to update anything here, because {@link defineProperty} already does it EVERYTIME we need it, ONLY when we need it
	 * 2) We need to untrack {@link Reflect.set}, because it may call {@link getOwnPropertyDescriptor} which would track the property
     * @inheritdoc
     */
    set<T extends object, K extends keyof T>(t: T, k: K, v: T[K], r: T) {
		return untrack(() => Reflect.set(t, k, v, r));
	}

    /**
     * -
     * Tracks the {@link k} property
     * @inheritdoc
     */
    has<T extends object>(t: T, k: keyof T) {
		const out = Reflect.has(t, k);
		this.track(t, k);
		return out;
	}

    /**
     * -
     * Updates the {@link k} property and {@link Internal.SHAPE} IF there actually WAS a property
     * @inheritdoc
     */
	deleteProperty<T extends object, K extends keyof T>(t: T, k: K) {
		const own = Object.hasOwn(t, k);
		if (!Reflect.deleteProperty(t, k)) return false;
		if (!own) return true;							// The delete operation returns `true` even when the property is not defined directly (Case in which it doesn't do anything)
		return batch(() => {
			const store = ReactiveHandler.getStore(t);	// You can NOT get the store safely from `r` because private fields are not inherited in the prototype chain (And `r` could be something else other than the proxy)
			this.update(t, k, store);
			this.update(t, Internal.SHAPE, store);
			return true;
		});
	}

    /**
     * -
     * Updates the {@link k} property and {@link Internal.SHAPE} IF the descriptor metadata changed.
     * Counterintuitively, this trap is called each time a value property is set
     * @inheritdoc
     */
	defineProperty<T extends object, K extends keyof T>(t: T, k: K, desc: TypedPropertyDescriptor<T[K]>) {
		const prev = Reflect.getOwnPropertyDescriptor(t, k);
		if (!Reflect.defineProperty(t, k, desc)) return false;
		return batch(() => {
			const store = ReactiveHandler.getStore(t);
			if (!prev) this.update(t, Internal.SHAPE, store);
			else if (compareDesc(this, t, k, desc, prev as TypedPropertyDescriptor<T[K]>)) return true;
			this.update(t, k, store);
			return true;
		});
	}

    /**
     * -
     * Tracks the {@link k} property
     * @inheritdoc
     */
	getOwnPropertyDescriptor<T extends object, K extends keyof T>(t: T, k: K): PropertyDescriptor | undefined {
		const out = Reflect.getOwnPropertyDescriptor(t, k);
		this.track(t, k);
		return out;
	}

    /**
     * -
     * Tracks {@link Internal.SHAPE}
     * @inheritdoc
     */
	ownKeys(t: object) {
		const out = Reflect.ownKeys(t);
		this.track(t, Internal.SHAPE);
		return out;
	}

    /**
     * -
     * Tracks {@link Internal.PROTO}
     * @inheritdoc
     */
	getPrototypeOf(t: object) {
		const out = Reflect.getPrototypeOf(t);
		this.track(t, Internal.PROTO);
		return out;
	}

    /**
     * -
     * Updates {@link Internal.PROTO}, {@link Internal.SHAPE} and every NOT own property IF the prototype actually changed
     * @param force Tells whether to force the update even if {@link proto} is the same as the previous prototype
     * @inheritdoc
     */
	setPrototypeOf(t: object, proto: object | null, force = false) {
		if (!force && proto === Reflect.getPrototypeOf(t)) return true;
		const out = Reflect.setPrototypeOf(t, proto);
		batch(() => {
			const store = ReactiveHandler.getStore(t);
			this.update(t, Internal.PROTO, store);
			this.update(t, Internal.SHAPE, store);
			for (const k of Reflect.ownKeys(store) as (keyof typeof store)[])
				if (!Object.hasOwn(t, k))
					this.update(t, k, store);
		});
		return out;
	}

    /**
     * -
     * Tracks {@link Internal.IS_EXTENSIBLE}
     * @inheritdoc
     */
	isExtensible(t: object) {
		const out = Reflect.isExtensible(t);
		this.track(t, Internal.IS_EXTENSIBLE);
		return out;
	}

    /**
     * -
     * Updates {@link Internal.IS_EXTENSIBLE}
     * @inheritdoc
     */
	preventExtensions(t: object) {
		if (!Reflect.preventExtensions(t)) return false;
		this.update(t, Internal.IS_EXTENSIBLE);
		return true;
	}

	/**
	 * Track the given key in the current effect
	 * @param t The object containing the key
	 * @param k The key to track for
	 * @param store The reactive tracker to use
	 * @returns Whether there was something to track
	 */
	track<T extends object>(t: T, k: ForceTarget<T>, store = ReactiveHandler.getStore(t)) {
		if (!getListener()) return false;
		const temp = store[k];
		if (temp === null) return false;
		const forcer = temp ?? (store[k] = createForcer(this.tag(t, k)));
		forcer.track();
		forcer.count++;
		onCleanup(() => !--forcer.count && delete store[k]);
		return true;
	}

	/**
	 * Force an update on the effects that are tracking the given key
	 * @param t The object containing the key
	 * @param k The key to update for
	 * @param store The reactive tracker to use
	 * @returns Whether there was something to update
	 */
	update<T extends object>(t: T, k: ForceTarget<T>, store = ReactiveHandler.getStore(t)) {
		const temp = store[k];
		if (!temp) return false;
		temp.update();
		return true;
	}

    /**
     * Tells whether {@link next} is different from {@link prev}
     * @param _t The object containing the values
     * @param _k The property containing the values
     * @param next The new value
     * @param prev The old value
     */
	compare<T extends object, K extends keyof T>(_t: T, _k: K, next: T[K], prev: T[K]) {
		return equalFn(next, prev);
	}

	/**
     * Obtains a tag for given a property that will be used as a name for its related internals
     * @param t The object for which to create the tag
     * @param k The key of the property for which to create the tag
     */
    tag<T extends object>(t: T, k: ForceTarget<T>) {
        return `${untrack(() => t.constructor)?.name}.${k.toString()}`;
    }
}

/**
 * Creates a memory efficient {@link Forcer} using a {@link Signal}
 * @param name A name to keep track of the {@link Forcer}
 * @returns An object which is both a {@link Forcer} and its own {@link Forcer.track} method
 */
function createForcer(name?: string): Forcer {
	const [ track, update ] = createSignal(undefined, { name, equals: false, internal: true });
	const out = track as unknown as Forcer;
	out.count = 0;
	out.track = track;
	out.update = update;
	return out;
}

/**
 * Compares two property descriptors
 * @param handler The {@link ReactiveHandler} that will provide the {@link ReactiveHandler.compare} method if needed
 * @param t The object containing the property defined by the descriptors
 * @param k The key of the property defined by the descriptors
 * @param next The new property descriptor
 * @param prev The old property descriptor
 */
function compareDesc<T extends object, K extends keyof T>(handler: ReactiveHandler, t: T, k: K, next: TypedPropertyDescriptor<T[K]>, prev: TypedPropertyDescriptor<T[K]>) {
	type temp = keyof typeof next;
	for (const elm in next)
		if (elm === "value" satisfies temp ? !handler.compare(t, k, next.value!, prev.value!) : next[elm as temp] !== prev[elm as temp])
			return false;
	return true;
}