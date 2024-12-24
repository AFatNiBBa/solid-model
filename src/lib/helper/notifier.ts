
import { getListener, onCleanup, createSignal, Signal } from "solid-js";
import { Store, Forcer, ForceTarget } from "./model";

/** Utility functions that handle the update of a {@link Store} */
export namespace Notifier {

	/**
     * Track the given key in the current effect
     * @param store The reactive tracker to use
     * @param k The key to track for
     */
    export function track<T>(store: Store<T>, k: ForceTarget<T>) {
        if (!getListener()) return;
        const temp = store[k];
        if (temp === null) return;
		const forcer = temp ?? (store[k] = createForcer());
        forcer.track();
        forcer.count++;
        onCleanup(() => !--forcer.count && delete store[k]);
    }

    /**
     * Force an update on the effects that are tracking the given key
     * @param store The reactive tracker to use
     * @param k The key to update for
     * @returns Whether there was something to update
     */
    export function update<T>(store: Store<T>, k: ForceTarget<T>) {
        const temp = store[k];
        if (!temp) return false;
        temp.update();
        return true;
    }
}

/**
 * Creates a memory efficient {@link Forcer} using a {@link Signal}
 * @returns An object which is both a {@link Forcer} and its own {@link Forcer.track} method
 */
function createForcer(): Forcer {
	const [ track, update ] = createSignal(undefined, { equals: false, internal: true });
	const out = track as unknown as Forcer;
	out.count = 0;
	out.track = track;
	out.update = update;
	return out;
}