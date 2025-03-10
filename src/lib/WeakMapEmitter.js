import { EventEmitter } from 'events';
export default class WeakMapEmitter extends EventEmitter {
    // Changed from WeakMap to Map so that we can iterate over the stored cleanup functions.
    cleanupFunctions = new Map();
    on(event, listener) {
        super.on(event, listener);
        const cleanupFn = () => {
            super.off(event, listener);
            this.cleanupFunctions.delete(listener); // Remove from Map on cleanup
        };
        this.cleanupFunctions.set(listener, cleanupFn);
        return this;
    }
    addListener(event, listener) {
        return this.on(event, listener); // Just use the 'on' implementation
    }
    removeListener(event, listener) {
        super.removeListener(event, listener);
        this.cleanupFunctions.delete(listener); // Ensure Map is updated on manual removal
        return this;
    }
    off(event, listener) {
        return this.removeListener(event, listener); // 'off' is an alias for 'removeListener'
    }
    removeAllListeners(event) {
        if (event) {
            this.listeners(event).forEach(listener => {
                // @ts-ignore
                this.cleanupFunctions.delete(listener);
            });
        }
        else {
            this.cleanupFunctions.clear(); // Clear all cleanup functions if removing all listeners
        }
        return super.removeAllListeners(event);
    }
    destroy() {
        // Iterate over all cleanup functions and call them.
        for (const cleanupFn of this.cleanupFunctions.values()) {
            cleanupFn();
        }
        super.removeAllListeners(); // Remove any remaining listeners as a final safety net.
    }
}
//# sourceMappingURL=WeakMapEmitter.js.map