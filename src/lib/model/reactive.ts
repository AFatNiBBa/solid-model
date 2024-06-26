
import { SignalOptions, createSignal, equalFn } from "solid-js";
import { Atom, ReadOnlyAtom } from "../helper/atom";
import { accessorToAtom } from "../helper/util";
import { BaseHandler } from "./base";

/**
 * Type of the {@link Atom} store of reactive objects, each key is a property getter that eventually has a setter.
 * If the property value is `undefined`, it means that the getter has not been cached yet.
 * If the property value is `null`, it means that the property has not to be proxied
 */
export type Store<T extends object> = { -readonly [k in keyof T]?: ReadOnlyAtom<T[k]> | null };

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
     * Empties the {@link Store} of the reactive object
     * @inheritdoc
     */
    static dispose(obj: object) {
        super.dispose(obj);
        this.getProxy(obj as ReactiveHandler).#store = Object.create(null);
    }

    /**
     * -
     * Reads the property from the {@link Store}, but still returns the value contained in {@link t} to avoid problems when interacting with the raw object directly.
     * Creates the property on the {@link Store} if necessary
     * @inheritdoc
     */
    get<T extends object, K extends keyof T>(t: T, k: K, r: T) {
        const store = ReactiveHandler.getStore(t); // You can NOT get this safely from `r` because private fields are not inherited in the prototype chain (And `r` could be something else other than the proxy)
        const temp = store[k];
        if (temp) return temp.value;
        if (temp === undefined) {
            var desc: PropertyDescriptor | undefined;
            if (!(k in t) || (desc = Object.getOwnPropertyDescriptor(t, k)) && !desc.get && !desc.set)
                return (store[k] = this.createAtom(t, k, desc?.value)).value;
            store[k] = null;
        }
        return Reflect.get(t, k, r);
    }

    /**
     * -
     * Writes the property from the {@link Store}, but still sets the value contained in {@link t} to avoid problems when interacting with the raw object directly.
     * Does NOT create the property on the {@link Store} if it's not already present, since nothing is listening to it yet anyway
     * @inheritdoc
     */
    set<T extends object, K extends keyof T>(t: T, k: K, v: T[K], r: T) {
        const store = ReactiveHandler.getStore(t);
        const temp = store[k];
        return temp?.trySet(v) || Reflect.set(t, k, v, r); // If there's a getter but not a setter I query the raw object since `MemoHandler` doesn't store the setter
    }

    /**
     * -
     * Deletes the property from the {@link Store} ONLY if it's an own property of {@link t}
     * @inheritdoc
     */
    deleteProperty<T extends object, K extends keyof T>(t: T, k: K) {
        if (Object.hasOwn(t, k)) delete ReactiveHandler.getStore(t)[k];
        return Reflect.deleteProperty(t, k);
    }

    /**
     * -
     * Sets the property from the {@link Store} to `null` (Not proxied) if {@link desc} has a getter or a setter, creates an {@link Atom} otherwise
     * @inheritdoc
     */
    defineProperty<T extends object, K extends keyof T>(t: T, k: K, desc: TypedPropertyDescriptor<T[K]>) {
        const store = ReactiveHandler.getStore(t);
        store[k] = desc.get || desc.set ? null : this.createAtom(t, k, desc.value!);
        return Reflect.defineProperty(t, k, desc);
    }

    /**
     * -
     * If the property is present, and it isn't one with accessors, the property from the {@link Store} gets tracked.
     * If the property on the {@link Store} is `null` it doesn't get tracked.
     * Creates the property on the {@link Store} if necessary
     * @inheritdoc
     */
    getOwnPropertyDescriptor<T extends object, K extends keyof T>(t: T, k: K): PropertyDescriptor | undefined {
        const desc = Reflect.getOwnPropertyDescriptor(t, k);
        if (!desc || desc.get || desc.set) return desc;
        const store = ReactiveHandler.getStore(t), temp = store[k];
        if (temp !== null)
            (temp ?? (store[k] = this.createAtom(t, k, desc.value!))).value;
        return desc;
    }

    /**
     * -
     * It removes everything that's not an own property of {@link t} from the {@link Store}
     * @inheritdoc
     */
    setPrototypeOf(t: object, proto: object | null) {
        const store = ReactiveHandler.getStore(t);
        for (const k of Reflect.ownKeys(store) as (keyof typeof store)[])
            if (!Object.hasOwn(t, k))
                delete store[k];
        return Reflect.setPrototypeOf(t, proto);
    }

    /**
     * Creates an {@link Atom} that is supposed to end up in the {@link Store} of {@link t}.
     * The output {@link Atom} will be the same object as its getter, to reduce memory footprint.
     * The getter will be wrapped in a function that returns the true value of the property, this will handle modifications on the raw object
     * @param t The object for which to create the {@link Atom}
     * @param k The key of the property for which to create the {@link Atom}
     * @param v The initial value of the {@link Atom}
     */
    createAtom<T extends object, K extends keyof T>(t: T, k: K, v: T[K]) {
        const opts: SignalOptions<T[K]> = { name: this.getPropertyTag(t, k), equals: this.getComparator(t, k), internal: true };
        const [ get, set ] = createSignal(v, opts)!; // It's an internal `Signal`, so there's no need for an `Owner`
        const out = accessorToAtom(() => (get(), t[k]), Atom<T[K]>);
        out.set = x => set(() => t[k] = x);
        return out;
    }

    /**
     * Gets a comparison function for a specific {@link IProperty}
     * @param _t The object containing the property that changed
     * @param _k The key of the property that changed
     */
    getComparator<T extends object, K extends keyof T>(_t: T, _k: K) {
        return equalFn<T[K]>;
    }

    /**
     * Obtains a tag for given a property that will be used as a name for its {@link Atom}
     * @param t The object for which to create the tag
     * @param k The key of the property for which to create the tag
     */
    getPropertyTag<T extends object>(t: T, k: keyof T) {
        return `${t.constructor?.name}.${k.toString()}`;
    }
}