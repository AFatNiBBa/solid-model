
import { Signal, SignalOptions, batch, createSignal, equalFn, runWithOwner } from "solid-js";
import { IProperty, Reactive } from "../data";

/** Handler that gives simple reactivity to arbitrary objects */
export class SignalHandler implements ProxyHandler<object> {
    /**
     * -
     * Reads the property from the {@link Signal} store, but still returns the value contained in {@link t} to avoid problems when interacting with the raw object directly.
     * Creates the property on the {@link Signal} store if necessary
     * @inheritdoc
     */
    get<T extends object, K extends keyof T>(t: T, k: K, r: T) {
        const store = Reactive.getStore(t); // You can NOT get this safely from `r` because private fields are not inherited in the prototype chain (And `r` could be something else other than the proxy)
        const temp = store[k];
        if (temp) return temp();
        if (temp === undefined) {
            var desc: PropertyDescriptor | undefined;
            if (!(k in t) || (desc = Object.getOwnPropertyDescriptor(t, k)) && !desc.get && !desc.set)
                return (store[k] = this.createSignal(t, k, desc?.value))();
            store[k] = null;
        }
        return Reflect.get(t, k, r);
    }

    /**
     * -
     * Writes the property from the {@link Signal} store, but still sets the value contained in {@link t} to avoid problems when interacting with the raw object directly.
     * Creates the property on the {@link Signal} store if necessary
     * @inheritdoc
     */
    set<T extends object, K extends keyof T>(t: T, k: K, v: T[K], r: T) {
        const store = Reactive.getStore(t);
        const temp = store[k];
        if (temp?.set) return temp.set(() => v), true; // If there's a getter but not a setter i query the raw object since `MemoHandler` doesn't store the setter
        if (temp === undefined) {
            var desc: PropertyDescriptor | undefined;
            store[k] = !(k in t) || (desc = Object.getOwnPropertyDescriptor(t, k)) && !desc.get && !desc.set
                ? this.createSignal(t, k, v)
                : null;
        }
        return Reflect.set(t, k, v, r);
    }

    /**
     * -
     * Deletes the property from the {@link Signal} store ONLY if it's an own property of {@link t}
     * @inheritdoc
     */
    deleteProperty<T extends object, K extends keyof T>(t: T, k: K) {
        if (Object.hasOwn(t, k)) delete Reactive.getStore(t)[k];
        return Reflect.deleteProperty(t, k);
    }

    /**
     * -
     * Sets the property from the {@link Signal} store to `null` (Not proxied) if {@link desc} has a getter or a setter, creates a {@link Signal} otherwise
     * @inheritdoc
     */
    defineProperty<T extends object, K extends keyof T>(t: T, k: K, desc: TypedPropertyDescriptor<T[K]>) {
        const store = Reactive.getStore(t);
        store[k] = desc.get || desc.set ? null : this.createSignal(t, k, desc.value!);
        return Reflect.defineProperty(t, k, desc);
    }

    /**
     * -
     * If the property is present, and it isn't one with accessors, the property from the {@link Signal} store gets tracked.
     * Creates the property on the {@link Signal} store if necessary
     * @inheritdoc
     */
    getOwnPropertyDescriptor<T extends object, K extends keyof T>(t: T, k: K): PropertyDescriptor | undefined {
        const desc = Reflect.getOwnPropertyDescriptor(t, k);
        if (desc && !desc.get && !desc.set)
            (Reactive.getStore(t)[k] ??= this.createSignal(t, k, desc.value!))();
        return desc;
    }

    /**
     * -
     * It removes everything that's not an own property of {@link t} from the {@link Signal} store
     * @inheritdoc
     */
    setPrototypeOf(t: object, proto: object | null) {
        const store = Reactive.getStore(t);
        for (const k of Reflect.ownKeys(store) as (keyof typeof store)[])
            if (!Object.hasOwn(t, k))
                delete store[k];
        return Reflect.setPrototypeOf(t, proto);
    }

    /**
     * Creates a {@link Signal} that is supposed to end up in the {@link Signal} store of {@link t}
     * @param t The object for which to create the {@link Signal}
     * @param k The key of the property for which to create the {@link Signal}
     * @param v The initial value of the {@link Signal}
     */
    createSignal<T extends object, K extends keyof T>(t: T, k: K, v: T[K]) {
        const opts: SignalOptions<T[K]> = { name: this.getPropertyTag(t, k), equals: (a, b) => this.compareChange(t, k, a, b) };
        const [ get, set ] = runWithOwner(Reactive.getOwner(t), () => createSignal(v, opts))!;
        const out: IProperty<T[K]> = () => (get(), t[k]);
        out.set! = (x?) => batch(() => t[k] = set(x!));
        return out!;
    }

    /**
     * Comparison function shared by each {@link IProperty} that will be created by this handler
     * @param t The object containing the property that changed
     * @param k The key of the property that changed
     * @param prev The old value of the property
     * @param next The new value of the property
     */
    compareChange<T extends object, K extends keyof T>(t: T, k: K, prev: T[K], next: T[K]) {
        return equalFn(prev, next);
    }

    /**
     * Obtains a tag for given a property that will be used as a name for its {@link Signal}
     * @param t The object for which to create the tag
     * @param k The key of the property for which to create the tag
     */
    getPropertyTag<T extends object>(t: T, k: keyof T) {
        return `${t.constructor?.name}.${k.toString()}`;
    }
}