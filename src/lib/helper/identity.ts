
/**
 * Returns the passed value
 * @param x The value to return
 */
export function IDENTITY<T>(x: T) { return x; }

/** Utilities for {@link IDENTITY} */
export namespace IDENTITY {

    /**
     * Class whose instance is the value passed to its constructor.
     * Allows you to extend a specific instance rather than a class.
     * This is required to be a member of {@link IDENTITY} rather than one of its signatures due to [this](https://github.com/microsoft/TypeScript/issues/63126) issue.
     * Private field example:
     * ```ts
     * class Something extends IDENTITY.Class<object> {
     *     #value = 12;
     *
     *     static get(obj: object) { return (obj as Something).#value; }
     *
     *     static set(obj: object, v: number) { (obj as Something).#value = v; }
     * }
     *
     * const a = {};
     * const b = new Something(a);
     * const c = a === b;               // true
     * const d = Something.get(a);      // 12
     * ```
     * Custom function example:
     * ```ts
     * class CoolFunction<T> extends IDENTITY.Class<() => T> {
     *     constructor(public f: () => T) { super(f); }
     * }
     *
     * const a = () => 12;
     * const b = new CoolFunction(a);
     * const c = a === b && b === b.f;  // true
     * const d = b();                   // 12
     * const e = b.f();                 // 12
     * ```
     */
	export const Class = IDENTITY as unknown as new <T extends object>(x: T) => T;
}