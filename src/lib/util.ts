
import { ReadOnlyAtom } from "./atom";
import { Accessor } from "solid-js";

/** Proxy that handles the core of {@link nameOf} */
const PROXY_KEYOF: NamesOf<any> = new Proxy({}, { get: (_, k) => k });

/** Type that maps each key of {@link T} to itself */
export type NamesOf<T> = { [k in keyof T]: k };

/**
 * Function that returns the name of the field accessed inside of {@link f}.
 * This function is not meant to be used on its own because it has very poor type inference
 * @param f A function that returns a value based on {@link NamesOf}
 * @returns The same thing that {@link f} returned
 */
export const nameOf = <T, const R>(f: (x: NamesOf<T>) => R) => f(PROXY_KEYOF);

/**
 * Gets the eventual getter of a property across the prototype chain using the fast deprecated method {@link Object.prototype.__lookupGetter__}
 * @param obj Object from which to get the getter
 * @param k Key of the property that may have a getter
 */
export const getGetter = Function.prototype.call.bind((<any>Object.prototype).__lookupGetter__) as <T, K extends keyof T>(obj: T, k: K) => (() => T[K]) | undefined;

/**
 * Creates a lightweight {@link ReadOnlyAtom} which has the same object for both the instance AND its getter to reduce memory footprint
 * @param f The getter
 * @param proto The prototype of the desired {@link ReadOnlyAtom} type
 * @returns A casted version of {@link f}
 */
export function accessorToAtom<T, A extends ReadOnlyAtom<T>>(f: Accessor<T>, proto: new(...args: any[]) => A = <any>ReadOnlyAtom) {
    const out: A = Object.setPrototypeOf(f, proto);
    Object.defineProperty(out, "get" satisfies keyof A, { get() { return this; } });
    return out;
}