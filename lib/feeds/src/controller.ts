import { inc, memoize, omitVals, max, min, now } from "@welshman/lib";
import type { TrustedEvent } from "@welshman/util";
import { EPOCH, trimFilters, guessFilterDelta } from "@welshman/util";
import type { Feed, RequestItem, FeedOptions } from "./core.js";
import { FeedType } from "./core.js";
import { FeedCompiler } from "./compiler.js";

export class FeedController {
  private compiler: FeedCompiler;

  constructor(readonly options: FeedOptions) {
    this.compiler = new FeedCompiler(options);
  }

  private getRequestItems = memoize(async (): Promise<RequestItem[] | undefined> => {
    return this.compiler.canCompile(this.options.feed)
      ? this.compiler.compile(this.options.feed)
      : undefined;
  });

  private getLoader = memoize(async () => {
    const [type, ...feed] = this.options.feed;
    const requestItems = await this.getRequestItems();

    if (requestItems) {
      return this.createRequestsLoader(requestItems);
    }

    switch (type) {
      case FeedType.Difference:
        return this.createDifferenceLoader(feed as Feed[]);
      case FeedType.Intersection:
        return this.createIntersectionLoader(feed as Feed[]);
      case FeedType.Union:
        return this.createUnionLoader(feed as Feed[]);
      default:
        throw new Error(`Unsupported feed type: ${type}`);
    }
  });

  public load = async (limit: number) => (await this.getLoader())(limit);

  private async createRequestsLoader(requests: RequestItem[], overrides: Partial<FeedOptions> = {}) {
    const { onEvent, onExhausted } = { ...this.options, ...overrides };
    const seen = new Set<string>();
    const exhausted = new Set<RequestItem>();
    const loaders = await Promise.all(
      requests.map((request) =>
        this.createRequestLoader(request, {
          onExhausted: () => exhausted.add(request),
          onEvent: (event: TrustedEvent) => {
            if (!seen.has(event.id)) {
              seen.add(event.id);
              onEvent?.(event);
            }
          },
        })
      )
    );

    return async (limit: number) => {
      await Promise.all(loaders.map((loader) => loader(limit)));
      if (exhausted.size === requests.length) onExhausted?.();
    };
  }

  private async createRequestLoader({ relays, filters }: RequestItem, overrides: Partial<FeedOptions> = {}) {
    const { useWindowing, onEvent, onExhausted, request } = { ...this.options, ...overrides };
    const effectiveFilters = filters?.length ? filters : [{}];
    const untils = effectiveFilters.flatMap((f) => (f.until ? [f.until] : []));
    const sinces = effectiveFilters.flatMap((f) => (f.since ? [f.since] : []));
    const maxUntil = untils.length === effectiveFilters.length ? max(untils) : now();
    const minSince = sinces.length === effectiveFilters.length ? min(sinces) : EPOCH;

    let loading = false;
    let delta = guessFilterDelta(effectiveFilters);
    let since = useWindowing ? maxUntil - delta : minSince;
    let until = maxUntil;

    return async (limit: number) => {
      if (loading) return;
      loading = true;

      const requestFilters = effectiveFilters
        .filter((f) => (f.since || minSince) < until && (f.until || maxUntil) > since)
        .map((f) => ({ ...f, until, limit, since }));

      if (!requestFilters.length) {
        onExhausted?.();
        loading = false;
        return;
      }

      let count = 0;
      await request(
        omitVals([undefined], {
          relays,
          filters: trimFilters(requestFilters),
          onEvent: (event: TrustedEvent) => {
            count++;
            until = Math.min(until, event.created_at - 1);
            onEvent?.(event);
          },
        })
      );

      if (useWindowing) {
        if (since === minSince) onExhausted?.();
        if (count < limit) {
          delta *= Math.round(100 * (2 - inc(count) / inc(limit)));
          until = since;
        }
        since = Math.max(minSince, until - delta);
      } else if (count === 0) {
        onExhausted?.();
      }

      loading = false;
    };
  }

  private async createDifferenceLoader(feeds: Feed[], overrides: Partial<FeedOptions> = {}) {
    const { onEvent, onExhausted, ...options } = { ...this.options, ...overrides };
    const exhausted = new Set<number>();
    const skip = new Set<string>();
    const events: TrustedEvent[] = [];
    const seen = new Set<string>();

    const controllers = await this.createControllers(feeds, options, (i, event) => {
      if (i === 0) events.push(event);
      else skip.add(event.id);
    }, exhausted);

    return async (limit: number) => {
      await Promise.all(controllers.map((c, i) => !exhausted.has(i) && c.load(limit)));
      for (const event of events.splice(0)) {
        if (!skip.has(event.id) && !seen.has(event.id)) {
          seen.add(event.id);
          onEvent?.(event);
        }
      }
      if (exhausted.size === controllers.length) onExhausted?.();
    };
  }

  private async createIntersectionLoader(feeds: Feed[], overrides: Partial<FeedOptions> = {}) {
    const { onEvent, onExhausted, ...options } = { ...this.options, ...overrides };
    const exhausted = new Set<number>();
    const counts = new Map<string, number>();
    const events: TrustedEvent[] = [];
    const seen = new Set<string>();

    const controllers = await this.createControllers(feeds, options, (_, event) => {
      events.push(event);
      counts.set(event.id, inc(counts.get(event.id)));
    }, exhausted);

    return async (limit: number) => {
      await Promise.all(controllers.map((c, i) => !exhausted.has(i) && c.load(limit)));
      for (const event of events.splice(0)) {
        if (counts.get(event.id) === controllers.length && !seen.has(event.id)) {
          seen.add(event.id);
          onEvent?.(event);
        }
      }
      if (exhausted.size === controllers.length) onExhausted?.();
    };
  }

  private async createUnionLoader(feeds: Feed[], overrides: Partial<FeedOptions> = {}) {
    const { onEvent, onExhausted, ...options } = { ...this.options, ...overrides };
    const exhausted = new Set<number>();
    const seen = new Set<string>();

    const controllers = await this.createControllers(feeds, options, (_, event) => {
      if (!seen.has(event.id)) {
        seen.add(event.id);
        onEvent?.(event);
      }
    }, exhausted);

    return async (limit: number) => {
      await Promise.all(controllers.map((c, i) => !exhausted.has(i) && c.load(limit)));
      if (exhausted.size === controllers.length) onExhausted?.();
    };
  }

  private async createControllers(
    feeds: Feed[],
    options: Omit<FeedOptions, "feed" | "onEvent" | "onExhausted">,
    onEvent: (i: number, event: TrustedEvent) => void,
    exhausted: Set<number>
  ) {
    return Promise.all(
      feeds.map((feed, i) =>
        new FeedController({
          ...options,
          feed,
          onExhausted: () => exhausted.add(i),
          onEvent: (event) => onEvent(i, event),
        })
      )
    );
  }
}