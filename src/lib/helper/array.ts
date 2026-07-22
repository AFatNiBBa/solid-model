
import { ReactiveHandler } from "../model/reactive";
import { $TRACK, For } from "solid-js";
import { ForceTarget } from "./type";

/**
 * Reactive version of the {@link Array}.
 * The {@link Array} results of methods are normal {@link Array}s
 */
export class ReactiveArray<T> extends Array<T> {
	constructor(list?: Iterable<T>) { 
		super();
		if (list) super.push(...list); // I call the base method to make the insertion NOT reactive (The list has just been created, so there can't be any observer to notify)
		return ReactiveArrayHandler.create(this);
	}

	/** Ensures that the {@link Array} results of methods are not reactive */
	static get [Symbol.species]() { return Array; }

	/** Allows the tracking of the whole array */
	get [$TRACK]() { return this; }

	/** Forces an update to the {@link length} property by calling {@link ReactiveHandler.update} */
	update() { return ReactiveArrayHandler.prototype.update<T[]>(this, "length"); }

	/**
	 * -
	 * Calls {@link update} and batches the notifications
	 * @inheritdoc
	 */
	push(...items: T[]) {
		const out = super.push(...items);
		this.update();
		return out;
	}

	/**
	 * -
	 * Calls {@link update} and batches the notifications
	 * @inheritdoc
	 */
	unshift(...items: T[]) {
		const out = super.unshift(...items);
		this.update();
		return out;
	}

	/**
	 * -
	 * Calls {@link update} and batches the notifications
	 * @inheritdoc
	 */
	pop() {
		const out = super.pop();
		this.update();
		return out;
	}

	/**
	 * -
	 * Calls {@link update} and batches the notifications
	 * @inheritdoc
	 */
	shift() {
		const out = super.shift();
		this.update();
		return out;
	}

	/**
	 * -
	 * Calls {@link update} IF at least an item has been added and/or removed and batches the notifications
	 * @inheritdoc
	 */
	splice(start: number, deleteCount?: number, ...items: T[]) {
		const out = super.splice(start, deleteCount!, ...items);
		if (out.length || items.length) this.update();
		return out;
	}
}

/** Like {@link ReactiveHandler}, but also notifies {@link $TRACK} to make {@link Array}s work */
export class ReactiveArrayHandler extends ReactiveHandler {

	/**
	 * -
	 * Every time an index or {@link Array.length} is updated, it updates {@link $TRACK} too.
	 * Normal {@link Array}s in JavaScript are exotic objects, which means that they're different from regular objects even on the engine level, this is why **"solid-js"** relies on {@link $TRACK} to make them work.
	 * For example, when methods with side effects change {@link Array.length}, they don't trigger the {@link ProxyHandler.set} trap.
	 * Making a normal object with an {@link Array} prototype would fix most of the problems, but things like {@link For} wouldn't work because, due to these problems, they now rely EXCLUSIVELY on {@link $TRACK}
	 * @inheritdoc
	 */
	update<T extends object>(t: T, k: ForceTarget<T>, store = ReactiveArrayHandler.getStore(t)) {
		if (!isArrayProp(k)) return super.update(t, k, store);
		const a = super.update(t, k, store);
		const b = super.update(t, $TRACK as ForceTarget<T>, store);
		return a || b; // (This is not done inline because we need to call both functions)
	}
}

/**
 * Tells whether a property key is an {@link Array} index or the {@link Array.length} property
 * @param k The property key to check
 */
function isArrayProp(k: PropertyKey) {
	if (typeof k !== "string") return false;
	if (k === "length") return true;
	const value = +k;
	return Number.isInteger(value) && value >= 0;
}