import {partition} from "src/lib"
import type {NetContext, RelaysAndFilters, Subscription} from "src/net"
import {
  defaultOptimizeSubscriptions,
  getDefaultNetContext as originalGetDefaultNetContext,
} from "src/net"
import type {StampedEvent, TrustedEvent} from "src/util"
import {isDVMKind, isEphemeralKind, LOCAL_RELAY_URL, unionFilters} from "src/util"
import {repository, tracker} from "./core.js"
import type {Router} from "./router.js"
import {getFilterSelections, makeRouter} from "./router.js"
import {signer} from "./session.js"

export type AppContext = {
  router: Router
  requestDelay: number
  authTimeout: number
  requestTimeout: number
  dufflepudUrl?: string
  indexerRelays?: string[]
}

export const getDefaultNetContext = (overrides: Partial<NetContext> = {}) => ({
  ...originalGetDefaultNetContext(),
  signEvent: async (event: StampedEvent) => signer.get()?.sign(event),
  onEvent: (url: string, event: TrustedEvent) => {
    if (isEphemeralKind(event.kind) || isDVMKind(event.kind)) return

    tracker.track(event.id, url)
    repository.publish(event)
  },
  isDeleted: (url: string, event: TrustedEvent) => repository.isDeleted(event),
  optimizeSubscriptions: (subs: Subscription[]) => {
    const [withRelays, withoutRelays] = partition(sub => sub.request.relays.length > 0, subs)
    const filters = unionFilters(withoutRelays.flatMap(sub => sub.request.filters))
    const selections: RelaysAndFilters[] = defaultOptimizeSubscriptions(withRelays)

    selections.push({relays: [LOCAL_RELAY_URL], filters})

    if (filters.length > 0) {
      for (const selection of getFilterSelections(filters)) {
        selections.push(selection)
      }
    }

    return selections
  },
  ...overrides,
})

export const getDefaultAppContext = (overrides: Partial<AppContext> = {}) => ({
  router: makeRouter(),
  requestDelay: 50,
  authTimeout: 300,
  requestTimeout: 3000,
  ...overrides,
})
