import type { Emitter } from "@welshman/lib";
import { ctx, noop } from "@welshman/lib";
import type { Filter, SignedEvent, TrustedEvent } from "@welshman/util";
import type { Message } from "./Socket.js";
import type { Connection } from "./Connection.js";
import { Negentropy, NegentropyStorageVector } from "./Negentropy.js";

// Interfaces and Types
export interface Target extends Emitter {
  connections: Connection[];
  send: (...args: Message) => Promise<void>;
  cleanup: () => void;
}

interface SubscribeOptions {
  onEvent?: EventCallback;
  onEose?: EoseCallback;
}

interface PublishOptions {
  verb?: string;
  onOk?: OkCallback;
  onError?: ErrorCallback;
}

interface DiffOptions {
  onError?: ErrorCallback;
  onMessage?: DiffMessageCallback;
  onClose?: CloseCallback;
}

type EventCallback = (url: string, event: TrustedEvent) => void;
type EoseCallback = (url: string) => void;
type CloseCallback = () => void;
type OkCallback = (url: string, id: string, ok: boolean, message: string) => void;
type ErrorCallback = (url: string, id: string, ...extra: any[]) => void;
type DiffMessage = { have: string[]; need: string[] };
type DiffMessageCallback = (url: string, message: DiffMessage) => void;

// Utility function
const generateSubId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

// Executor Class
export class Executor {
  constructor(readonly target: Target) {}

  subscribe(filters: Filter[], options: SubscribeOptions = {}) {
    const { onEvent, onEose } = options;
    const subId = generateSubId("REQ");
    let isClosed = false;

    const eventListener = (url: string, id: string, event: TrustedEvent) => {
      if (id !== subId) return;
      ctx.net.onEvent(url, event);
      onEvent?.(url, event);
    };

    const eoseListener = (url: string, id: string) => {
      if (id === subId) onEose?.(url);
    };

    this.target.on("EVENT", eventListener);
    this.target.on("EOSE", eoseListener);
    this.target.send("REQ", subId, ...filters);

    return {
      unsubscribe: () => {
        if (isClosed) return;

        this.target.send("CLOSE", subId).catch(noop);
        this.target.off("EVENT", eventListener);
        this.target.off("EOSE", eoseListener);
        isClosed = true;
      },
    };
  }

  publish(event: SignedEvent, options: PublishOptions = {}) {
    const { verb = "EVENT", onOk, onError } = options;

    const okListener = (url: string, id: string, ok: boolean, message: string) => {
      if (id !== event.id) return;
      if (ok) ctx.net.onEvent(url, event);
      onOk?.(url, id, ok, message);
    };

    const errorListener = (url: string, id: string, ...payload: any[]) => {
      if (id !== event.id) return;
      onError?.(url, id, ...payload);
    };

    this.target.on("OK", okListener);
    this.target.on("ERROR", errorListener);
    this.target.send(verb, event);

    return {
      unsubscribe: () => {
        this.target.off("OK", okListener);
        this.target.off("ERROR", errorListener);
      },
    };
  }

  diff(filter: Filter, events: TrustedEvent[], options: DiffOptions = {}) {
    const { onMessage, onError, onClose } = options;
    const negId = generateSubId("NEG");
    let isClosed = false;

    const storage = new NegentropyStorageVector();
    const negentropy = new Negentropy(storage, 50_000);

    // Populate storage with events
    events.forEach(event => storage.insert(event.created_at, event.id));
    storage.seal();

    const msgListener = async (url: string, id: string, msg: string) => {
      if (id !== negId) return;

      const [newMsg, have, need] = await negentropy.reconcile(msg);
      onMessage?.(url, { have, need });

      if (newMsg) {
        this.target.send("NEG-MSG", negId, newMsg);
      } else {
        close();
      }
    };

    const errListener = (url: string, id: string, msg: string) => {
      if (id === negId) onError?.(url, msg);
    };

    const close = () => {
      if (isClosed) return;

      this.target.send("NEG-CLOSE", negId).catch(noop);
      this.target.off("NEG-MSG", msgListener);
      this.target.off("NEG-ERR", errListener);

      isClosed = true;
      onClose?.();
    };

    this.target.on("NEG-MSG", msgListener);
    this.target.on("NEG-ERR", errListener);

    negentropy.initiate().then(msg => {
      this.target.send("NEG-OPEN", negId, filter, msg);
    });

    return { unsubscribe: close };
  }
}