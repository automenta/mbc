import {debounce} from "throttle-debounce"
import {derived, writable} from "svelte/store"
import type {Feed, RequestOpts} from "@welshman/feeds"
import {FeedController} from "@welshman/feeds"
import {
  always,
  assoc,
  chunk,
  ctx,
  first,
  HOUR,
  int,
  max,
  noop,
  partition,
  sleep,
  sortBy,
  uniq,
  WEEK,
  without,
} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {
  Address,
  DELETE,
  DEPRECATED_DIRECT_MESSAGE,
  EPOCH,
  FEED,
  FEEDS,
  getIdFilters,
  HANDLER_INFORMATION,
  HANDLER_RECOMMENDATION,
  LABEL,
  NAMED_BOOKMARKS,
  WRAP,
} from "@welshman/util"
import {Tracker} from "@welshman/net"
import {deriveEvents} from "@welshman/store"
import type {AppSyncOpts} from "@welshman/app"
import {
  getFilterSelections,
  getFollows,
  getPubkeysForScope,
  getPubkeysForWOTRange,
  hasNegentropy,
  loadFollows,
  loadMutes,
  loadProfile,
  pubkey,
  pull,
  repository,
  requestDVM,
} from "@welshman/app"
import {noteKinds, reactionKinds} from "src/util/nostr"
import {race} from "src/util/misc"
import {CUSTOM_LIST_KINDS} from "src/domain"
import {env, load, type MySubscribeRequest, subscribe} from "src/engine/state"

// Utils

let notificationSubscription
let messageSubscription

const DEFAULT_EVENT_OVERLAP = int(HOUR)
const CONSERVATIVE_PULL_LIMIT = 100
const PROFILE_LOAD_CHUNK_SIZE = 50
const PROFILE_LOAD_DELAY = 300
const PEOPLE_SEARCH_DEBOUNCE_DELAY = 500
const PEOPLE_SEARCH_MIN_LENGTH = 2
const PEOPLE_SEARCH_THROTTLE_DELAY = 1000

export const addSinceToFilter = (filter, overlap = DEFAULT_EVENT_OVERLAP) => {
  const limit = 50
  const events = repository.query([{...filter, limit}])

  const since =
    events.length < limit ? EPOCH : max(events.map(e => e.created_at).concat(EPOCH)) - overlap

  return {...filter, since}
}

export const pullConservatively = ({relays, filters}: AppSyncOpts) => {
  const [smartRelays, dumbRelays] = partition(hasNegentropy, relays)
  const promises = [pull({relays: smartRelays, filters})]

  if (dumbRelays.length > 0) {
    let filtersForDumb = filters
    const events = sortBy(e => -e.created_at, repository.query(filters))

    if (events.length > CONSERVATIVE_PULL_LIMIT) {
      filtersForDumb = filters.map(assoc("since", events[CONSERVATIVE_PULL_LIMIT]!.created_at))
    }

    promises.push(pull({relays: dumbRelays, filters: filtersForDumb}))
  }

  return Promise.all(promises)
}

// export const loadAll = (feed, {onEvent}: {onEvent: (e: TrustedEvent) => void}) => {
//   const loading = writable(true)
//   const onExhausted = () => loading.set(false)
//
//   const promise = new Promise<void>(async resolve => {
//     const ctrl = createFeedController({feed, onEvent, onExhausted})
//
//     while (get(loading)) {
//       await ctrl.load(100)
//     }
//
//     resolve()
//   })
//
//   return {promise, loading, stop: onExhausted}
// }

export const loadEvent = async (
  eventIdOrAddress: string,
  request: Partial<MySubscribeRequest> = {},
) =>
  first(
    await load({
      ...request,
      skipCache: true,
      forcePlatform: false,
      filters: getIdFilters([eventIdOrAddress]),
    }),
  )

export const deriveEvent = (
  eventIdOrAddress: string,
  request: Partial<MySubscribeRequest> = {},
) => {
  let attempted = false
  const filters = getIdFilters([eventIdOrAddress])

  return derived(
    deriveEvents(repository, {filters, includeDeleted: true}),
    (events: TrustedEvent[]) => {
      if (!attempted && events.length === 0) {
        if (Address.isAddress(eventIdOrAddress) && !request.relays) {
          const {pubkey: eventPubkey, relays} = Address.from(eventIdOrAddress)
          request.relays = uniq([...relays, ...ctx.app.router.ForPubkey(eventPubkey).getUrls()])
        }
        loadEvent(eventIdOrAddress, request)
        attempted = true
      }

      return events[0]
    },
  )
}

type PeopleLoaderOpts = {
  shouldLoad?: (term: string) => boolean
  onEvent?: (e: TrustedEvent) => void
}

export const createPeopleLoader = ({
  shouldLoad = always(true),
  onEvent = noop,
}: PeopleLoaderOpts = {}) => {
  const loading = writable(false)

  return {
    loading,
    load: debounce(PEOPLE_SEARCH_DEBOUNCE_DELAY, term => {
      if (term.length > PEOPLE_SEARCH_MIN_LENGTH && shouldLoad(term)) {
        const now = Date.now()

        loading.set(true)

        load({
          onEvent,
          skipCache: true,
          forcePlatform: false,
          filters: [{kinds: [0], search: term, limit: 100}],
          onComplete: async () => {
            await sleep(Math.min(PEOPLE_SEARCH_THROTTLE_DELAY, Date.now() - now))
            loading.set(false)
          },
        })
      }
    }),
  }
}

export const loadPubkeys = async (pubkeys: string[]) => {
  for (const pubkeyChunk of chunk(PROFILE_LOAD_CHUNK_SIZE, pubkeys)) {
    await sleep(PROFILE_LOAD_DELAY)

    for (const pubkey of pubkeyChunk) {
      loadProfile(pubkey)
      loadFollows(pubkey)
      loadMutes(pubkey)
    }
  }
}

export type FeedRequestHandlerOptions = {forcePlatform: boolean; signal: AbortSignal}

export const makeFeedRequestHandler =
  ({forcePlatform, signal}: FeedRequestHandlerOptions) =>
  async ({relays, filters, onEvent}: RequestOpts) => {
    const tracker = new Tracker()
    const requestOptions = {
      onEvent,
      tracker,
      forcePlatform,
      skipCache: true,
      delay: 0,
    }

    if (relays?.length > 0) {
      await load({...requestOptions, filters, relays, signal, authTimeout: 3000})
    } else {
      await race(
        filters.every(f => f.search) ? 0.1 : 0.8,
        getFilterSelections(filters).flatMap(({relays, filters}) =>
          relays.map(relay => load({...requestOptions, relays: [relay], signal, filters})),
        ),
      )

      for (const event of repository.query(filters)) {
        onEvent(event)
      }
    }
  }

export type FeedControllerOptions = {
  feed: Feed
  onEvent: (event: TrustedEvent) => void
  onExhausted: () => void
  forcePlatform?: boolean
  useWindowing?: boolean
  signal?: AbortSignal
}

export const createFeedController = ({forcePlatform = true, ...options}: FeedControllerOptions) => {
  const request = makeFeedRequestHandler({forcePlatform, signal: options.signal})
  return new FeedController({
    request,
    requestDVM,
    getPubkeysForScope,
    getPubkeysForWOTRange,
    ...options,
  })
}

export const getNotificationKinds = () =>
  without(env.ENABLE_ZAPS ? [] : [9735], [...noteKinds, ...reactionKinds])

const notificationFilters = () => {
  const filter = {kinds: getNotificationKinds(), "#p": [pubkey.get()]}
  return [addSinceToFilter(filter, int(WEEK))]
}

const liveNotificationFilters = () => {
  const filter = {kinds: getNotificationKinds(), "#p": [pubkey.get()]}
  return [addSinceToFilter(filter)]
}

export const loadNotifications = () => {
  if (notificationSubscription) {
    notificationSubscription.close()
  }

  return pullConservatively({
    relays: ctx.app.router.ForUser().getUrls(),
    filters: notificationFilters(),
  })
}

export const listenForNotifications = () => {
  if (notificationSubscription) notificationSubscription.close()

  return (notificationSubscription = subscribe({
    skipCache: true,
    relays: ctx.app.router.ForUser().getUrls(),
    filters: liveNotificationFilters(),
  }))
}

export const loadLabels = (authors: string[]) =>
  load({
    skipCache: true,
    forcePlatform: false,
    filters: [addSinceToFilter({kinds: [LABEL], authors, "#L": ["#t"]})],
  })

export const loadDeletes = () =>
  load({
    skipCache: true,
    forcePlatform: false,
    filters: [addSinceToFilter({kinds: [DELETE], authors: [pubkey.get()]})],
  })

export const loadFeedsAndLists = () =>
  load({
    skipCache: true,
    forcePlatform: false,
    filters: [
      addSinceToFilter({
        kinds: [FEED, FEEDS, NAMED_BOOKMARKS, ...CUSTOM_LIST_KINDS],
        authors: [pubkey.get()],
      }),
    ],
  })

export const loadMessages = () =>
  pullConservatively({
    relays: ctx.app.router
      .merge([ctx.app.router.ForUser(), ctx.app.router.FromUser(), ctx.app.router.UserInbox()])
      .getUrls(),
    filters: [
      {kinds: [DEPRECATED_DIRECT_MESSAGE], authors: [pubkey.get()]},
      {kinds: [DEPRECATED_DIRECT_MESSAGE, WRAP], "#p": [pubkey.get()]},
    ],
  })

export const listenForMessages = (pubkeys: string[]) => {
  const allPubkeys = uniq([pubkey.get(), ...pubkeys])

  if (messageSubscription) {
    messageSubscription.close()
  }

  messageSubscription = subscribe({
    skipCache: true,
    forcePlatform: false,
    relays: ctx.app.router
      .merge([
        ctx.app.router.ForPubkeys(pubkeys),
        ctx.app.router.FromPubkeys(pubkeys),
        ctx.app.router.PubkeyInboxes(pubkeys),
      ])
      .getUrls(),
    filters: [
      {kinds: [DEPRECATED_DIRECT_MESSAGE], authors: allPubkeys, "#p": allPubkeys},
      {kinds: [WRAP], "#p": [pubkey.get()]},
    ],
  })

  return messageSubscription
}

export const loadHandlers = () =>
  load({
    skipCache: true,
    forcePlatform: false,
    relays: [...ctx.app.router.ForUser().getUrls(), "wss://relay.nostr.band/"],
    filters: [
      addSinceToFilter({
        kinds: [HANDLER_RECOMMENDATION],
        authors: getFollows(pubkey.get()),
      }),
      addSinceToFilter({kinds: [HANDLER_INFORMATION]}),
    ],
  })
