
import { Accessor, Setter, Signal, createMemo, createSignal, on, untrack } from "solid-js";
import { NamesOf, nameOf } from "./util";

/** Read-only version of {@link Atom} */
export class ReadOnlyAtom<T> {
	get value() { return this.get(); }

	constructor(public get: Accessor<T>) { }

	/**
	 * Tries to set the value of the current object.
	 * This version does nothing, use {@link Atom}'s override to get some work done
	 * @returns Whether the operation succeded, so always `false`
	 */
	trySet(_: T) { return false; }
}

/** Reactive atomic value without the inconveniences of {@link Signal} */
export class Atom<T> extends ReadOnlyAtom<T> {
	get value() { return super.value; } // It doesn't get inherited by default due to the fact that adding the setter overrides the whole property

	set value(v: T) { this.set(v); }

	constructor(get: Accessor<T>, public set: (x: T) => void) { super(get); }
	
	/**
	 * Tries to set the value of the current object.
	 * The same as calling {@link set}, but you can call it on {@link ReadOnlyAtom}s too
	 * @param value The value to set
	 * @returns Whether the operation succeded, so always `true`
	 */
	trySet(value: T): boolean { return this.value = value, true; }

	/**
     * Allows you to set the current {@link Atom} based on its current value.
     * The current value gets read through {@link untrack} to mimic the {@link Setter} behaviour
     * @param f Function that creates a new value based on the current one
     */
	update<V extends T>(f: (prev: T) => V): V { return this.value = f(untrack(this.get)); }

	/**
     * Creates a new {@link Atom} that applies a conversion to the current one
     * @param to Conversion function from {@link S} to {@link D}
     * @param from Conversion function from {@link D} to {@link S}
     */
	convert<R>(to: (x: T) => R, from: (x: R) => T) { return new Atom(() => to(this.value), v => this.value = from(v)); }

    /**
     * Creates an {@link Atom} that forwards an {@link Accessor} to another {@link Atom}
     * @param f The reactive {@link Accessor} to the {@link Atom} to forward
     */
	static unwrap<T>(f: Accessor<Atom<T>>) { return new this(() => f().value, v => f().value = v); }

    /**
     * Creates an {@link Atom} based on a {@link Signal}
     * @param param0 The {@link Signal} to forward
     */
	static from<T>([ get, set ]: Signal<T>) { return new this(get, v => set(() => v)); }

	/**
	 * Creates an {@link Atom} based on an object property.
	 * The result of {@link k} will be memoized, while {@link obj}'s one won't
	 * @param obj The object containing the property
	 * @param k A function that returns the key of the property and will be passed to {@link nameOf}
	 */
	static prop<T, K extends keyof T>(obj: Accessor<T>, k: (x: NamesOf<T>) => K) {
		const temp = createMemo(() => nameOf<T, K>(k));
		return new this(() => obj()[temp()], v => obj()[temp()] = v);
	}

	/**
     * Creates a bindable data source.
     * If {@link bind} returns an {@link Atom} it gets wrapped, otherwise it creates a {@link Signal} using {@link f} and uses it to store the value until {@link bind}'s value changes
     * @param bind The bound {@link Atom}
     * @param f The function that will create the actual {@link Signal} that will store the {@link Atom}'s data in case that {@link bind} doesn't return anything
     */
	static source<T>(bind: Accessor<Atom<T> | undefined>): Atom<T | undefined>;
	static source<T>(bind: Accessor<Atom<T> | undefined>, f: Accessor<Signal<T>>): Atom<T>;
	static source<T>(bind: Accessor<Atom<T> | undefined>, f: Accessor<Signal<T | undefined>> = createSignal<T>) {
		return this.unwrap(createMemo(on(bind, x => x as Atom<T | undefined> ?? Atom.from(f()))));
	}
}