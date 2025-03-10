import { EventEmitter } from "events";

/**
 * Extended EventEmitter that also emits all events to '*' listeners.
 * Provides enhanced event emission with wildcard support.
 */
export class Emitter extends EventEmitter {
  /**
   * Emits an event to listeners of the specified type and to '*' listeners.
   * @param type - The event type/name.
   * @param args - Arguments to pass to the listeners.
   * @returns True if the event had listeners for either the specific type or the wildcard ('*').
   */
  emit(type: string, ...args: any[]): boolean {
    // Emit to specific event listeners
    const hasSpecificListeners = super.emit(type, ...args);
    // Emit to wildcard listeners, passing the event type as the first argument
    const hasWildcardListeners = super.emit("*", type, ...args);

    // Return true if either the specific event or wildcard had listeners
    return hasSpecificListeners || hasWildcardListeners;
  }

  /**
   * Adds a listener for an event or wildcard.
   * @param event - The event type/name or '*' for all events.
   * @param listener - The callback to handle the event.
   * @returns This Emitter instance for chaining.
   */
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  /**
   * Removes a listener for an event or wildcard.
   * @param event - The event type/name or '*' for all events.
   * @param listener - The callback to remove.
   * @returns This Emitter instance for chaining.
   */
  off(event: string, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }
}