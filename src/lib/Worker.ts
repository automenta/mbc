import { remove } from "./Tools.js";

// Symbol for global handlers
const ANY = Symbol("worker/ANY");

// Configuration options for Worker
export type WorkerOptions<T> = {
  getKey?: (message: T) => unknown;
  shouldDefer?: (message: T) => boolean;
  chunkSize?: number;
  delay?: number;
};

/**
 * Worker for processing messages in batches with throttling.
 * Optimized for CPU and memory efficiency.
 * @template T The type of messages to process.
 */
export class Worker<T> {
  buffer: T[] = [];
  private handlers: Map<unknown, Array<(message: T) => void>> = new Map();
  private timeoutId: NodeJS.Timeout | undefined;
  private isPaused = false;
  private readonly chunkSize: number;
  private readonly delay: number;

  constructor(options: WorkerOptions<T> = {}) {
    // Set defaults in constructor to avoid runtime checks
    this.chunkSize = options.chunkSize ?? 50;
    this.delay = options.delay ?? 50;
    this.getKey = options.getKey; // Direct assignment to avoid closure overhead
    this.shouldDefer = options.shouldDefer;
  }

  // Cache option functions as instance methods to avoid property lookup overhead
  private readonly getKey?: (message: T) => unknown;
  private readonly shouldDefer?: (message: T) => boolean;

  // Public API

  /** Adds a message to the processing queue. */
  push(message: T): void {
    this.buffer.push(message);
    if (!this.isPaused && !this.timeoutId) {
      this.timeoutId = setTimeout(() => this.processBatch(), this.delay);
    }
  }

  /** Adds a handler for messages with a specific key. */
  addHandler(key: unknown, handler: (message: T) => void): void {
    const currentHandlers = this.handlers.get(key);
    if (currentHandlers) {
      currentHandlers.push(handler); // Mutate existing array to avoid allocation
    } else {
      this.handlers.set(key, [handler]); // Minimal allocation for new key
    }
  }

  /** Removes a handler for messages with a specific key. */
  removeHandler(key: unknown, handler: (message: T) => void): void {
    const currentHandlers = this.handlers.get(key);
    if (!currentHandlers) return;

    const updatedHandlers = remove(handler, currentHandlers);
    if (updatedHandlers.length > 0) {
      this.handlers.set(key, updatedHandlers);
    } else {
      this.handlers.delete(key); // Free memory by removing empty handler lists
    }
  }

  /** Adds a handler for all messages. */
  addGlobalHandler(handler: (message: T) => void): void {
    this.addHandler(ANY, handler);
  }

  /** Removes a handler for all messages. */
  removeGlobalHandler(handler: (message: T) => void): void {
    this.removeHandler(ANY, handler);
  }

  /** Removes all pending messages from the queue. */
  clear(): void {
    this.buffer.length = 0; // Faster than reassignment, reuses array
  }

  /** Pauses message processing. */
  pause(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    this.isPaused = true;
  }

  /** Resumes message processing. */
  resume(): void {
    this.isPaused = false;
    if (!this.timeoutId && this.buffer.length > 0) {
      this.timeoutId = setTimeout(() => this.processBatch(), this.delay);
    }
  }

  // Private Methods

  private async processBatch(): Promise<void> {
    // Use local variables to minimize property lookups in hot path
    const buffer = this.buffer;
    const chunkSize = this.chunkSize;
    const shouldDefer = this.shouldDefer;
    const getKey = this.getKey;
    const handlers = this.handlers;

    // Process up to chunkSize messages or until buffer is empty
    let processed = 0;
    while (processed < chunkSize && buffer.length > 0) {
      const message = buffer.shift()!;

      if (shouldDefer?.(message)) {
        buffer.push(message);
        processed++;
        continue;
      }

      // Process global handlers
      const globalHandlers = handlers.get(ANY);
      if (globalHandlers) {
        await this.executeHandlers(globalHandlers, message);
      }

      // Process key-specific handlers
      if (getKey) {
        const key = getKey(message);
        const specificHandlers = handlers.get(key);
        if (specificHandlers) {
          await this.executeHandlers(specificHandlers, message);
        }
      }

      processed++;
    }

    this.timeoutId = undefined;
    if (!this.isPaused && buffer.length > 0) {
      this.timeoutId = setTimeout(() => this.processBatch(), this.delay);
    }
  }

  private async executeHandlers(
    handlers: Array<(message: T) => void>,
    message: T
  ): Promise<void> {
    // Use for loop with index to avoid iterator overhead
    for (let i = 0, len = handlers.length; i < len; i++) {
      try {
        await handlers[i](message);
      } catch (error) {
        console.error("Handler error:", error);
      }
    }
  }
}