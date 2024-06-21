
import { ReadOnlyAtom } from "./atom";
import { Accessor } from "solid-js";

/** Function that returns whaterver got inside of it and can be used as a class */
export const IDENTITY: { (x: any): any, new(x?: any): { } } = function(x: any) { return x; } as any;

/**
 * Makes an instance function static.
 * It creates a function that behaves like {@link Function.call} of {@link f}.
 * Example:
 * ```js
 * f.call(a, b);
 * staticCall(f)(a, b);
 * ```
 * @param f The function to make static
 */
export const staticCall = <T, Args extends readonly unknown[], R>(f: (this: T, ...args: Args) => R) => Function.prototype.call.bind(f) as (x: T, ...args: Args) => R;

/**
 * Gets the eventual getter of a property across the prototype chain using the fast deprecated method {@link Object.prototype.__lookupGetter__}
 * @param obj Object from which to get the getter
 * @param k Key of the property that may have a getter
 */
export const getGetter = staticCall((<any>Object.prototype).__lookupGetter__ as <T, K extends keyof T>(this: T, k: K) => { (): T[K] } | undefined);

/**
 * Creates a lightweight {@link ReadOnlyAtom} which has the same object for both the instance AND its getter to reduce memory footprint
 * @param f The getter
 * @param proto The prototype of the desired {@link ReadOnlyAtom} type
 * @returns A casted version of {@link f}
 */
export function accessorToAtom<T, A extends ReadOnlyAtom<T>>(f: Accessor<T>, ctor: new(...args: any[]) => A = <any>ReadOnlyAtom) {
    const out: A = Object.setPrototypeOf(f, ctor.prototype);
    Object.defineProperty(out, "get" satisfies keyof A, { get() { return this; } });
    return out;
}