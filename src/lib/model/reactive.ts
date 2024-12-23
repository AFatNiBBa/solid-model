
import { compareDescriptor } from "../helper/util";
import { Internal, Store } from "../helper/model";
import { Notifier } from "../helper/notifier";
import { batch, equalFn } from "solid-js";
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
		Notifier.track(ReactiveHandler.getStore(t), k); // You can NOT get the store safely from `r` because private fields are not inherited in the prototype chain (And `r` could be something else other than the proxy)
		return out;
	}

    /**
     * -
     * Tracks the {@link k} property
     * @inheritdoc
     */
    has<T extends object>(t: T, k: keyof T) {
		const out = Reflect.has(t, k);
		Notifier.track(ReactiveHandler.getStore(t), k);
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
		if (!own) return true; // The delete operation returns `true` even when the property is not defined directly (Case in which it doesn't do anything)
		batch(() => {
			const store = ReactiveHandler.getStore(t);
			Notifier.update(store, k);
			Notifier.update(store, Internal.SHAPE);
		});
		return true;
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
		if (compareDescriptor(desc, prev)) return true;
		batch(() => {
			const store = ReactiveHandler.getStore(t);
			Notifier.update(store, k);
			Notifier.update(store, Internal.SHAPE);
		});
		return true;
	}

    /**
     * -
     * Tracks the {@link k} property
     * @inheritdoc
     */
	getOwnPropertyDescriptor<T extends object, K extends keyof T>(t: T, k: K): PropertyDescriptor | undefined {
		const out = Reflect.getOwnPropertyDescriptor(t, k);
		Notifier.track(ReactiveHandler.getStore(t), k);
		return out;
	}

    /**
     * -
     * Tracks {@link Internal.SHAPE}
     * @inheritdoc
     */
	ownKeys(t: object) {
		const out = Reflect.ownKeys(t);
		Notifier.track(ReactiveHandler.getStore(t), Internal.SHAPE);
		return out;
	}

    /**
     * -
     * Tracks {@link Internal.PROTO}
     * @inheritdoc
     */
	getPrototypeOf(t: object) {
		const out = Reflect.getPrototypeOf(t);
		Notifier.track(ReactiveHandler.getStore(t), Internal.PROTO);
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
			Notifier.update(store, Internal.PROTO);
			Notifier.update(store, Internal.SHAPE);
			for (const k of Reflect.ownKeys(store) as (keyof typeof store)[])
				if (!Object.hasOwn(t, k))
					Notifier.update(store, k);
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
		Notifier.track(ReactiveHandler.getStore(t), Internal.IS_EXTENSIBLE);
		return out;
	}

    /**
     * -
     * Updates {@link Internal.IS_EXTENSIBLE}
     * @inheritdoc
     */
	preventExtensions(t: object) {
		if (!Reflect.preventExtensions(t)) return false;
		Notifier.update(ReactiveHandler.getStore(t), Internal.IS_EXTENSIBLE);
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
}