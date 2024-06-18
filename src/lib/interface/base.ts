
/** Class that returns the first argument provided to its constructor as its instance */
export class Identity { constructor(obj: object) { return obj; } }

/** Class that defines the private properties that will be put inside the targets directly */
export class TargetHandler extends Identity {
    #proxy?: object;

    constructor(target: object, proxy?: object) {
        super(target);
        this.#proxy = proxy;
    }

    /**
     * Tells whether the provided object has an attached {@link Proxy}.
     * Is the same as {@link getProxy} but returns `undefined` instead of throwing when no {@link Proxy} created by this library as ever been attached to {@link obj}
     * @param obj The eventually proxied object
     * @returns The {@link Proxy}, if there's any
     */
    static is<T extends object>(obj: T) { return #proxy in obj ? (obj as TargetHandler).#proxy as T | undefined : undefined; }

    /**
     * Gets the attached {@link Proxy} of an object
     * @param obj The proxied object
     */
    static getProxy<T extends object>(obj: T) { return (obj as TargetHandler).#proxy as T; }

    /**
     * Sets the attached {@link Proxy} of an object.
     * Can be used to detatch the {@link Proxy}
     * @param obj The proxied object
     * @param value The new {@link Proxy}
     */
    static setProxy<T extends object>(obj: T, value?: T) {
        if (#proxy in obj) (obj as TargetHandler).#proxy = value;
        else new TargetHandler(obj, value);
    }
}

/** Class that defines the private properties that will be put inside every {@link Proxy} created with this library */
export class BaseHandler extends TargetHandler {
    #raw: object;

    constructor(target: object, proxy: object) {
        TargetHandler.setProxy(target, proxy);
        super(proxy, proxy);
        this.#raw = target;
    }

    /**
     * Gets the raw target of a proxied object
     * @param obj The proxied object
     */
    static getRaw<T extends object>(obj: T) { return this.getProxy(obj as BaseHandler).#raw as T; }

    /**
     * Creates a proxy for an object using the current handler.
     * The current constructor will be called on {@link obj} to define the private fields, and the prototype of the current class will be used as a {@link ProxyHandler}
     * @param obj The object to make proxied
     */
    static create<T extends object>(obj: T) { return new this(obj, new Proxy(obj, this.prototype as ProxyHandler<object>)) as T; }
}