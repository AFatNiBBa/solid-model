
import { Owner, createRoot, getOwner } from "solid-js";
import { MemoHandler } from "./memo";

/** Like {@link MemoHandler}, but creates an {@link Owner} of its own (That needs to be explicitly disposed) instead of using the current one */
export class DisposableHandler extends MemoHandler {
    #dispose: () => void;

    constructor(target: object, proxy: object) {
        var owner: Owner;
        const d = createRoot(d => (owner = getOwner()!, d));
        super(target, proxy, owner!);
        this.#dispose = d;
    }

    /**
     * Gets the disposer function of an unmanaged memoized object
     * @param obj The memoized object
     */
    static getDisposer(obj: object) { return this.getProxy(obj as DisposableHandler).#dispose; }
}