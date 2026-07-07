import { world } from "@minecraft/server";
/**
 * World-Class Event Coordinator
 * Reduces bridge-crossing overhead by using a single native listener
 * to distribute events to multiple internal modules.
 */
export class EventCoordinator {
    // Separate storage for After and Before events to prevent namespace collisions
    static afterListeners = new Map();
    static beforeListeners = new Map();
    static afterNativeSubs = new Map();
    static beforeNativeSubs = new Map();
    /**
     * Subscribe a callback lazily to an AfterEvent.
     * Only creates the native Minecraft subscription if this is the first listener.
     */
    static subscribeAfter(event, callback) {
        if (!this.afterListeners.has(event)) {
            this.afterListeners.set(event, new Set());
        }
        const set = this.afterListeners.get(event);
        set.add(callback);
        if (set.size === 1) {
            const nativeSub = world.afterEvents[event].subscribe((data) => {
                for (const listener of this.afterListeners.get(event)) {
                    try {
                        listener(data);
                    }
                    catch (e) {
                        console.error(`[Coordinator] Error in afterEvents.${event} listener:`, e);
                    }
                }
            });
            this.afterNativeSubs.set(event, nativeSub);
        }
    }
    /**
     * Subscribe a callback lazily to a BeforeEvent.
     * These are critical for cancellation logic (e.g., Anti-Spam or Movement correction).
     */
    static subscribeBefore(event, callback) {
        if (!this.beforeListeners.has(event)) {
            this.beforeListeners.set(event, new Set());
        }
        const set = this.beforeListeners.get(event);
        set.add(callback);
        if (set.size === 1) {
            const nativeSub = world.beforeEvents[event].subscribe((data) => {
                for (const listener of this.beforeListeners.get(event)) {
                    try {
                        listener(data);
                    }
                    catch (e) {
                        console.error(`[Coordinator] Error in beforeEvents.${event} listener:`, e);
                    }
                }
            });
            this.beforeNativeSubs.set(event, nativeSub);
        }
    }
    /**
     * Unsubscribe a callback from an AfterEvent.
     */
    static unsubscribeAfter(event, callback) {
        const set = this.afterListeners.get(event);
        if (!set)
            return;
        set.delete(callback);
        if (set.size === 0) {
            world.afterEvents[event].unsubscribe(this.afterNativeSubs.get(event));
            this.afterNativeSubs.delete(event);
        }
    }
    /**
     * Unsubscribe a callback from a BeforeEvent.
     */
    static unsubscribeBefore(event, callback) {
        const set = this.beforeListeners.get(event);
        if (!set)
            return;
        set.delete(callback);
        if (set.size === 0) {
            world.beforeEvents[event].unsubscribe(this.beforeNativeSubs.get(event));
            this.beforeNativeSubs.delete(event);
        }
    }
}
