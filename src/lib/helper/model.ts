
import { Accessor, Owner } from "solid-js";

/** Type of a directly disposable {@link Owner} */
export interface DisposableOwner extends Owner, Disposable { }

/** Object that handles a forcing */
export type Forcer = { count: number, track(): void, update(): void };

/**
 * Object that stores the {@link Forcer} for each forceable part of {@link T}.
 * If the property value is `undefined`, it means that there's currently no listener for the property.
 * If the property value is `null`, it means that it has been opted out of reactivity
 */
export type Store<T> = { -readonly [k in ForceTarget<T>]?: Forcer | null };

/**
 * Object that stores the memos for each getter of {@link T}.
 * If the property value is `undefined`, it means that the getter has not been cached yet.
 * If the property value is `null`, it means that no getter should be made for this property
 */
export type Cache<T> = { -readonly [k in keyof T]?: Accessor<T[k]> | null };

/**
 * A collection of symbols that each represents an object's internal.
 * Is used to notify changes to those internals
 */
export namespace Internal {
    export const IS_EXTENSIBLE = Symbol("[[IsExtensible]]");
    export const PROTO = Symbol("[[Prototype]]");
    export const SHAPE = Symbol("[[Shape]]");
}

/** Union of all the forceable parts of {@link T} */
export type ForceTarget<T> = 
    | keyof T
    | typeof Internal.IS_EXTENSIBLE
    | typeof Internal.PROTO
    | typeof Internal.SHAPE;