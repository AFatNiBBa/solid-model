
import { Accessor, Owner, Setter, Signal, createRoot, getOwner } from "solid-js";
import { SignalHandler } from "./interface/signal";

/** Registry that disposes the {@link Owner} of a reactive object when its proxy goes out of scope */
const disposer = new FinalizationRegistry<() => void>(d => d());

/** Class that returns the first argument provided to its constructor as its instance */
class Identity<T extends object> { constructor(obj: T) { return obj; } }

/** Class that contains the proxy of a reactive object */
class RawData<T extends object> extends Identity<T> {
    #proxy!: InstanceType<typeof RawData.ProxyData<T>>;

    /** Class of the proxy of a reactive object */
    static ProxyData = class ProxyData<T extends object> extends this<T> {
        #raw!: RawData<T>;
        #store!: Store<T>;
        #owner!: Owner;

        /**
         * Tells whether the provided object is reactive
         * @param obj The eventually reactive object
         */
        static is(obj: object) { return #proxy in obj && !!obj.#proxy; }

        /**
         * Gets the proxy of a reactive object
         * @param obj The reactive object
         */
        static getProxy<T extends object>(obj: T) { return (obj as RawData<T>).#proxy as T; }

        /**
         * Gets the raw version of a reactive object
         * @param obj The reactive object
         */
        static getRaw<T extends object>(obj: T) { return (obj as RawData<T>).#proxy.#raw as T; }

        /**
         * Gets the {@link Signal} store of a reactive object
         * @param obj The reactive object
         */
        static getStore<T extends object>(obj: T) { return (obj as RawData<T>).#proxy.#store; }

        /**
         * Gets the {@link Owner} of a reactive object
         * @param obj The reactive object
         */
        static getOwner(obj: object) { return (obj as RawData<object>).#proxy.#owner; }

        /**
         * Removes the proxy from a reactive object, thus removing its reactivity
         * @param obj The reactive object
         */
        static dispose(obj: object) { (obj as RawData<object>).#proxy.#raw.#proxy = undefined!; }

        /**
         * Creates a reactive proxy for an object
         * @param obj The object to make reactive
         * @param handler The {@link ProxyHandler} to use
         */
        static create<T extends object>(obj: T, handler: ProxyHandler<object> = SignalHandler.prototype) {
            const temp = #proxy in obj && obj.#proxy;
            if (temp) return temp as T;
            const rawData = new RawData(obj), proxyData = new ProxyData(new Proxy(obj, handler) as T);
            rawData.#proxy = proxyData.#proxy = proxyData;
            proxyData.#raw = rawData;
            proxyData.#store = Object.create(null);            
            var owner!: Owner, d = createRoot(d => (owner = getOwner()!, d)); // I can't set `proxyData.#owner` directly to ensure that the function passed to `createRoot()` (Which is kept alive by `d()`) doesn't keep `proxyData` alive
            proxyData.#owner = owner;
            disposer.register(proxyData, d);
            return proxyData as T;
        }
    };
}

/**
 * Type of the {@link Signal} store of reactive objects, each key is a property getter that eventually has a setter.
 * If the property value is `undefined`, it means that the getter has not been cached yet.
 * If the property value is `null`, it means that the property has not to be proxied
 */
export type Store<T extends object> = { [k in keyof T]?: IProperty<T[k]> | null };

/** Extensible interface that represents the posssible content of a {@link Store} */
export interface IProperty<T> extends Accessor<T> { set?: Setter<T>; }

/** Utility methods to interact with a reactive object */
export const Reactive = RawData.ProxyData;