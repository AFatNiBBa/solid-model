
/** Function that returns whaterver got inside of it and can be used as a class */
export const IDENTITY: { (x: any): any, new(x?: any): { } } = function(x: any) { return x; } as any;

/** Function that does nothing */
export const NO_OP = () => { };

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
 * Compares two {@link PropertyDescriptor}s.
 * Defining a property means to merge the new descriptor to the old one, only what's on the {@link next} descriptor can change
 * @param next The new descriptor to merge
 * @param prev The old descriptor to be merged with
 */
export function compareDescriptor(next: PropertyDescriptor, prev?: PropertyDescriptor) {
	if (!prev) return false;
	for (const k in next)
		if (next[k as keyof typeof next] !== prev[k as keyof typeof prev])
			return false;
	return true;
}