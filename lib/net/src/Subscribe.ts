import { chunk, ctx, Emitter, groupBy, max, once, randomId, uniq } from "@welshman/lib";
import type { Filter } from "@welshman/util";
import { LOCAL_RELAY_URL, matchFilters, normalizeRelayUrl, TrustedEvent, unionFilters } from "@welshman/util";
import { Tracker } from "./Tracker.js";
import { Executor } from "./Executor.js";
import { Connection } from "./Connection.js";
import { ConnectionEvent } from "./ConnectionEvent.js";

/**
 * Enum representing subscription events
 */
export enum SubscriptionEvent {
  Eose = "eose",
  Send = "send",
  Close = "close",
  Event = "event",
  Complete = "complete",
  Duplicate = "duplicate",
  DeletedEvent = "deleted-event",
  FailedFilter = "failed-filter",
  Invalid = "invalid",
}

/**
 * Type for relay and filter combinations
 */
export type RelaysAndFilters = {
  relays: string[];
  filters: Filter[];
};

/**
 * Type for subscription requests
 */
export type SubscribeRequest = RelaysAndFilters & {
  delay?: number;
  signal?: AbortSignal;
  timeout?: number;
  tracker?: Tracker;
  closeOnEose?: boolean;
  authTimeout?: number;
};

/**
 * Manages a subscription to Nostr relays with event handling
 */
export class Subscription extends Emitter {
  readonly id: string = randomId();
  readonly controller: AbortController = new AbortController();
  readonly tracker: Tracker;
  private completed: Set<string> = new Set();
  private executorSubs: Array<{ unsubscribe: () => void }> = [];
  private executor: Executor;

  constructor(readonly request: SubscribeRequest) {
    super();
    this.tracker = request.tracker ?? new Tracker();
    this.executor = ctx.net.getExecutor(request.relays);
    this.setMaxListeners(100);
  }

  onEvent = (url: string, event: TrustedEvent): void => {
    const eventType = this.tracker.track(event.id, url) ? SubscriptionEvent.Duplicate :
      ctx.net.isDeleted(url, event) ? SubscriptionEvent.DeletedEvent :
        !ctx.net.matchFilters(url, this.request.filters, event) ? SubscriptionEvent.FailedFilter :
          !ctx.net.isValid(url, event) ? SubscriptionEvent.Invalid :
            SubscriptionEvent.Event;

    this.emit(eventType, url, event);
  };

  onEose = (url: string): void => {
    this.completed.add(url);
    this.emit(SubscriptionEvent.Eose, url);
    if (this.request.closeOnEose && this.relaysCompleted()) this.onComplete();
  };

  onClose = (connection: Connection): void => {
    this.completed.add(connection.url);
    this.emit(SubscriptionEvent.Close, connection.url);
    if (this.relaysCompleted()) this.onComplete();
  };

  private relaysCompleted(): boolean {
    return this.completed.size === uniq(this.request.relays).length;
  }

  onComplete = once((): void => {
    this.emit(SubscriptionEvent.Complete);
    this.executorSubs.forEach(s => s.unsubscribe());
    this.executor.target.connections.forEach(c => c.off(ConnectionEvent.Close, this.onClose));
    this.removeAllListeners();
  });

  async execute(): Promise<void> {
    const { filters, signal, timeout, authTimeout = 0 } = this.request;
    if (!filters.length) {
      this.emit(SubscriptionEvent.Send);
      this.onComplete();
      return;
    }

    signal?.addEventListener("abort", this.onComplete);
    this.controller.signal.addEventListener("abort", this.onComplete);
    if (timeout) setTimeout(this.onComplete, timeout + authTimeout);

    this.executor.target.connections.forEach(c => c.on(ConnectionEvent.Close, this.onClose));
    if (authTimeout) {
      await Promise.all(this.executor.target.connections.map(c => c.auth.attempt(authTimeout)));
    }

    for (const f of chunk(8, filters)) {
      this.executorSubs.push(this.executor.subscribe(f, { onEvent: this.onEvent, onEose: this.onEose }));
    }
    this.emit(SubscriptionEvent.Send);
  }

  close(): void {
    this.controller.abort();
  }
}

/**
 * Calculates a grouping key for subscriptions
 */
export const calculateSubscriptionGroup = (sub: Subscription): string => {
  const parts: string[] = [];
  if (sub.request.timeout) parts.push(`timeout:${sub.request.timeout}`);
  if (sub.request.authTimeout) parts.push(`authTimeout:${sub.request.authTimeout}`);
  if (sub.request.closeOnEose) parts.push("closeOnEose");
  return parts.join("|");
};

/**
 * Merges multiple subscriptions into a single one
 */
export const mergeSubscriptions = (subs: Subscription[]): Subscription => {
  const mergedSub = new Subscription({
    relays: uniq(subs.flatMap(s => s.request.relays)),
    filters: unionFilters(subs.flatMap(s => s.request.filters)),
    timeout: max(subs.map(s => s.request.timeout || 0)),
    authTimeout: max(subs.map(s => s.request.authTimeout || 0)),
    closeOnEose: subs.every(s => s.request.closeOnEose),
  });

  mergedSub.controller.signal.addEventListener("abort", () => subs.forEach(s => s.close()));
  const completedSubs = new Set<string>();

  for (const sub of subs) {
    sub.on(SubscriptionEvent.Event, (url: string, event: TrustedEvent) => {
      if (!mergedSub.tracker.track(event.id, url)) mergedSub.emit(SubscriptionEvent.Event, url, event);
    });

    sub.on(SubscriptionEvent.Complete, () => {
      completedSubs.add(sub.id);
      if (completedSubs.size === subs.length) mergedSub.emit(SubscriptionEvent.Complete);
      sub.removeAllListeners();
    });

    [
      SubscriptionEvent.Duplicate,
      SubscriptionEvent.DeletedEvent,
      SubscriptionEvent.FailedFilter,
      SubscriptionEvent.Invalid,
      SubscriptionEvent.Eose,
      SubscriptionEvent.Send,
      SubscriptionEvent.Close
    ].forEach(type => sub.on(type, (...args: any[]) => mergedSub.emit(type, ...args)));
  }

  return mergedSub;
};

/**
 * Optimizes subscriptions by grouping and merging
 */
const optimizeSubscriptions = (subs: Subscription[]): Subscription[] => {
  return Array.from(groupBy(calculateSubscriptionGroup, subs).values()).flatMap(group => {
    const timeout = max(group.map(s => s.request.timeout || 0));
    const authTimeout = max(group.map(s => s.request.authTimeout || 0));
    const closeOnEose = group.every(s => s.request.closeOnEose);
    const state = {
      completed: new Set<string>(),
      aborted: new Set<string>(),
      closed: new Set<string>(),
      eosed: new Set<string>(),
      sent: new Set<string>()
    };
    const mergedSubs: Subscription[] = [];

    for (const { relays, filters } of ctx.net.optimizeSubscriptions(group)) {
      for (const filter of filters) {
        const mergedSub = new Subscription({ filters: [filter], relays, timeout, authTimeout, closeOnEose });

        for (const { id, controller, request } of group) {
          const onAbort = () => {
            state.aborted.add(id);
            if (state.aborted.size === group.length) mergedSub.close();
          };
          request.signal?.addEventListener("abort", onAbort);
          controller.signal.addEventListener("abort", onAbort);
        }

        const propagateEvent = (type: SubscriptionEvent) =>
          mergedSub.on(type, (url: string, event: TrustedEvent) => {
            for (const sub of group) {
              if (matchFilters(sub.request.filters, event) && !sub.tracker.track(event.id, url)) {
                sub.emit(type, url, event);
              }
            }
          });

        [SubscriptionEvent.Event, SubscriptionEvent.Duplicate, SubscriptionEvent.DeletedEvent, SubscriptionEvent.Invalid]
          .forEach(propagateEvent);

        const propagateFinality = (type: SubscriptionEvent, set: Set<string>) =>
          mergedSub.on(type, (...args: any[]) => {
            set.add(mergedSub.id);
            if (set.size === mergedSubs.length) group.forEach(s => s.emit(type, ...args));
            if (type === SubscriptionEvent.Complete) mergedSub.removeAllListeners();
          });

        propagateFinality(SubscriptionEvent.Send, state.sent);
        propagateFinality(SubscriptionEvent.Eose, state.eosed);
        propagateFinality(SubscriptionEvent.Close, state.closed);
        propagateFinality(SubscriptionEvent.Complete, state.completed);

        mergedSubs.push(mergedSub);
      }
    }

    return mergedSubs;
  });
};

/**
 * Executes a single subscription
 */
const executeSubscription = (sub: Subscription): void => {
  optimizeSubscriptions([sub]).forEach(s => s.execute());
};

/**
 * Executes multiple subscriptions
 */
const executeSubscriptions = (subs: Subscription[]): void => {
  optimizeSubscriptions(subs).forEach(s => s.execute());
};

/**
 * Batched subscription execution
 */
const executeSubscriptionBatched = (() => {
  const subs: Subscription[] = [];
  const timeouts: NodeJS.Timeout[] = [];

  return (sub: Subscription) => {
    subs.push(sub);
    timeouts.push(setTimeout(() => {
      executeSubscriptions(subs.splice(0));
      timeouts.splice(0).forEach(clearTimeout);
    }, Math.max(16, sub.request.delay ?? 50)));
  };
})();

/**
 * Type for subscription requests with handlers
 */
export type SubscribeRequestWithHandlers = SubscribeRequest & {
  onEvent?: (event: TrustedEvent) => void;
  onEose?: (url: string) => void;
  onClose?: (url: string) => void;
  onComplete?: () => void;
};

/**
 * Creates a subscription with handlers
 */
export const subscribe = ({
                            onEvent,
                            onEose,
                            onClose,
                            onComplete,
                            ...request
                          }: SubscribeRequestWithHandlers): Subscription => {
  const sub = new Subscription({ delay: 50, ...request });

  if (request.relays.some(r => r !== LOCAL_RELAY_URL && r !== normalizeRelayUrl(r))) {
    console.warn("Non-normalized relay URLs detected");
  }

  if (request.delay === 0) {
    executeSubscription(sub)
  } else {
    executeSubscriptionBatched(sub)
  }

  if (onEvent) sub.on(SubscriptionEvent.Event, (_url, event) => onEvent(event))
  if (onEose) sub.on(SubscriptionEvent.Eose, onEose);
  if (onClose) sub.on(SubscriptionEvent.Close, onClose);
  if (onComplete) sub.on(SubscriptionEvent.Complete, onComplete);

  return sub;
};