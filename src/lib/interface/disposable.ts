
import { Owner, createRoot, getOwner } from "solid-js";
import { ReactiveHandler } from "./reactive";

/** Type of the explicitly disposable {@link Owner} of {@link DisposableHandler}s */
export interface DisposableOwner extends Owner, Disposable { }

/** Like {@link ReactiveHandler}, but has an internal general-purpose {@link DisposableOwner} */
export class DisposableHandler extends ReactiveHandler {
    #owner: DisposableOwner;

    constructor(target: object, proxy: object) {
        super(target, proxy);
        this.#owner = createRoot(d => {
            const out = <DisposableOwner>getOwner();
            out[Symbol.dispose] = d;
            return out;
        });
    }
    
    /**
     * Gets the disposable {@link Owner} of a disposable reactive object
     * @param obj The reactive object
     */
    static getOwner(obj: object) { return this.getProxy(obj as DisposableHandler).#owner; }
}