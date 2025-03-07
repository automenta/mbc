import Fuse from "fuse.js"
import {getPow} from "nostr-tools/nip13"
import {derived, get, writable} from "svelte/store"

import type {PartialSubscribeRequest} from "@welshman/app"
import {
  db,
  displayProfileByPubkey,
  ensurePlaintext,
  followsByPubkey,
  freshness,
  getDefaultAppContext,
  getDefaultNetContext,
  getNetwork,
  getSession,
  getSigner,
  getUserWotScore,
  handles,
  initStorage,
  loadRelay,
  makeRouter,
  makeTrackerStore,
  maxWot,
  mutesByPubkey,
  pinsByPubkey,
  plaintext,
  profilesByPubkey,
  pubkey,
  publishThunk,
  relay,
  relays,
  repository,
  session,
  sessions,
  setPlaintext,
  signer,
  storageAdapters,
  subscribe as baseSubscribe,
  tracker,
  zappers,
} from "@welshman/app"
import {
  ago,
  cached,
  ctx,
  groupBy,
  HOUR,
  identity,
  max,
  now,
  partition,
  prop,
  pushToMapKey,
  setContext,
  simpleCache,
  sort,
  sortBy,
  take,
  uniq,
} from "@welshman/lib"
import type {Connection, PublishRequest, Target} from "@welshman/net"
import {
  AuthMode,
  ConnectionEvent,
  Executor,
  Local,
  Multi,
  Relays,
  SubscriptionEvent,
} from "@welshman/net"
import {Nip01Signer} from "@welshman/signer"
import {deriveEvents, deriveEventsMapped, synced, withGetter} from "@welshman/store"
import type {
  EventTemplate,
  HashedEvent,
  PublishedList,
  SignedEvent,
  StampedEvent,
  TrustedEvent,
} from "@welshman/util"
import {
  APP_DATA,
  asDecryptedEvent,
  createEvent,
  DIRECT_MESSAGE,
  FEED,
  FEEDS,
  FOLLOWS,
  getAddress,
  getAddressTagValues,
  getIdentifier,
  getListTags,
  getPubkeyTagValues,
  getReplyTagValues,
  getTag,
  getTagValue,
  getTagValues,
  HANDLER_INFORMATION,
  HANDLER_RECOMMENDATION,
  isHashedEvent,
  LABEL,
  LOCAL_RELAY_URL,
  makeList,
  MUTES,
  NAMED_BOOKMARKS,
  normalizeRelayUrl,
  readList,
  WRAP,
} from "@welshman/util"

import type {
  PublishedFeed,
  PublishedFeedUserList,
  PublishedListFeed,
  PublishedUserList,
} from "src/domain"
import {
  CollectionSearch,
  displayFeed,
  EDITABLE_LIST_KINDS,
  getHandlerAddress,
  mapListToFeed,
  readCollections,
  readFeed,
  readHandlers,
  readUserList,
  subscriptionNotices,
  UserListSearch,
} from "src/domain"
import type {AnonymousUserState, Channel, SessionWithMeta} from "src/engine/model"
import logger from "src/util/logger"
import {fromCsv, parseJson, SearchHelper} from "src/util/misc"
import {appDataKeys, metaKinds, noteKinds, reactionKinds, repostKinds} from "src/util/nostr"

const envVars = import.meta.env

const {
  VITE_CLIENT_ID,
  VITE_CLIENT_NAME,
  VITE_DEFAULT_FOLLOWS,
  VITE_DEFAULT_RELAYS,
  VITE_INDEXER_RELAYS,
  VITE_DUFFLEPUD_URL,
  VITE_DVM_RELAYS,
  VITE_ENABLE_MARKET,
  VITE_ENABLE_ZAPS,
  VITE_BLUR_CONTENT,
  VITE_IMGPROXY_URL,
  VITE_NIP96_URLS,
  VITE_BLOSSOM_URLS,
  VITE_ONBOARDING_LISTS,
  VITE_PLATFORM_PUBKEY,
  VITE_PLATFORM_RELAYS,
  VITE_PLATFORM_ZAP_SPLIT,
  VITE_SEARCH_RELAYS,
  VITE_SIGNER_RELAYS,
  VITE_APP_URL,
  VITE_APP_NAME,
} = envVars

export const env = {
  CLIENT_ID: VITE_CLIENT_ID as string,
  CLIENT_NAME: VITE_CLIENT_NAME as string,
  DEFAULT_FOLLOWS: fromCsv(VITE_DEFAULT_FOLLOWS),
  DEFAULT_RELAYS: fromCsv(VITE_DEFAULT_RELAYS).map(normalizeRelayUrl) as string[],
  INDEXER_RELAYS: fromCsv(VITE_INDEXER_RELAYS).map(normalizeRelayUrl) as string[],
  DUFFLEPUD_URL: VITE_DUFFLEPUD_URL as string,
  DVM_RELAYS: fromCsv(VITE_DVM_RELAYS).map(normalizeRelayUrl) as string[],
  ENABLE_MARKET: JSON.parse(VITE_ENABLE_MARKET) as boolean,
  ENABLE_ZAPS: JSON.parse(VITE_ENABLE_ZAPS) as boolean,
  BLUR_CONTENT: JSON.parse(VITE_BLUR_CONTENT) as boolean,
  IMGPROXY_URL: VITE_IMGPROXY_URL as string,
  NIP96_URLS: fromCsv(VITE_NIP96_URLS) as string[],
  BLOSSOM_URLS: fromCsv(VITE_BLOSSOM_URLS) as string[],
  ONBOARDING_LISTS: fromCsv(VITE_ONBOARDING_LISTS) as string[],
  PLATFORM_PUBKEY: VITE_PLATFORM_PUBKEY as string,
  PLATFORM_RELAYS: fromCsv(VITE_PLATFORM_RELAYS).map(normalizeRelayUrl) as string[],
  PLATFORM_ZAP_SPLIT: parseFloat(VITE_PLATFORM_ZAP_SPLIT) as number,
  SEARCH_RELAYS: fromCsv(VITE_SEARCH_RELAYS).map(normalizeRelayUrl) as string[],
  SIGNER_RELAYS: fromCsv(VITE_SIGNER_RELAYS).map(normalizeRelayUrl) as string[],
  APP_URL: VITE_APP_URL,
  APP_NAME: VITE_APP_NAME,
}

export const sessionWithMeta = withGetter(derived(session, $session => $session as SessionWithMeta))

export const hasNip44 = derived(signer, $signer => Boolean($signer?.nip44))

export const anonymous = withGetter(writable<AnonymousUserState>({follows: [], relays: []}))

export const canDecrypt = withGetter(synced("canDecrypt", false))


export const trackerStore = makeTrackerStore({throttle: 1000})

// Settings
export const defaultSettings = {
  auto_authenticate: false,
  blossom_urls: env.BLOSSOM_URLS.slice(0, 1),
  default_zap: 21,
  dufflepud_url: env.DUFFLEPUD_URL,
  enable_client_tag: false,
  hide_sensitive: true,
  ignore_muted_content: true,
  imgproxy_url: env.IMGPROXY_URL,
  min_pow_difficulty: 0,
  min_wot_score: 0,
  muted_words: [],
  nip96_urls: env.NIP96_URLS.slice(0, 1),
  note_actions: ["zaps", "replies", "reactions", "recommended_apps"],
  platform_zap_split: env.PLATFORM_ZAP_SPLIT,
  pow_difficulty: 0,
  relay_limit: 5,
  report_analytics: true,
  send_delay: 0,
  show_media: true,
  upload_type: "nip96",
}

export const settingsEvents = deriveEvents(repository, {filters: [{kinds: [APP_DATA]}]})

export const userSettingsEvent = derived([pubkey, settingsEvents], ([$pubkey, $settingsEvents]) =>
  $settingsEvents.find(
    event => event.pubkey === $pubkey && getIdentifier(event) === appDataKeys.USER_SETTINGS,
  ),
)

export const userSettingsPlaintext = derived(
  [plaintext, userSettingsEvent],
  ([$plaintext, $userSettingsEvent]) => $plaintext[$userSettingsEvent?.id],
)

export const userSettings = withGetter<typeof defaultSettings>(
  derived(userSettingsPlaintext, $userSettingsPlaintext => {
    const overrides = parseJson($userSettingsPlaintext) || {}
    return {...defaultSettings, ...overrides}
  }),
)

export const getSetting = <T = any>(key: string): T => prop(key)(userSettings.get()) as T

const IMGPROXY_DEFAULT_WIDTH = 640
const IMGPROXY_DEFAULT_HEIGHT = 1024

export const imgproxy = (url: string, {w = IMGPROXY_DEFAULT_WIDTH, h = IMGPROXY_DEFAULT_HEIGHT} = {}) => {
  if (!url || url.endsWith(".gif")) {
    return url
  }

  const baseUrl = getSetting("imgproxy_url")
  if (!baseUrl) {
    return url
  }

  const urlWithoutParams = url.split("?")[0]

  try {
    return `${baseUrl}/x/s:${w}:${h}/${btoa(urlWithoutParams)}`
  } catch (error) {
    logger.error("Imgproxy URL creation error", error)
    return url
  }
}

export const dufflepud = (path: string) => {
  const base = getSetting("dufflepud_url")

  if (!base) {
    throw new Error("Dufflepud not enabled")
  }

  return `${base}/${path}`
}

// User follows/mutes/network

export const getMinWot = () => getSetting("min_wot_score") / maxWot.get()

export const userFollowList = derived([followsByPubkey, pubkey, anonymous], ([$m, $pk, $anon]) =>
  $pk ? $m.get($pk) : makeList({kind: FOLLOWS, publicTags: $anon.follows}),
)

export const userFollows = derived(userFollowList, list => new Set(getPubkeyTagValues(getListTags(list))))

export const userNetwork = derived(userFollowList, list => getNetwork(list.event.pubkey))

export const userMuteList = derived([mutesByPubkey, pubkey], ([$m, $pk]) => $m.get($pk))

export const userMutes = derived(
  userMuteList,
  list => new Set(getTagValues(["p", "e"], getListTags(list))),
)

export const userPinList = derived([pinsByPubkey, pubkey], ([$m, $pk]) => $m.get($pk))

export const userPins = derived(userPinList, list => new Set(getTagValues(["e"], getListTags(list))))

const EVENT_MUTE_CACHE_SIZE = 5000

export const isEventMuted = withGetter(
  derived(
    [userMutes, userFollows, userSettings, profilesByPubkey, pubkey],
    ([$userMutes, $userFollows, $userSettings, $profilesByPubkey, $pubkey]) => {
      const mutedWords = $userSettings.muted_words
      const minWot = $userSettings.min_wot_score
      const minPow = $userSettings.min_pow_difficulty
      const mutedWordsRegex =
        mutedWords.length > 0
          ? new RegExp(`\\b(${mutedWords.map(word => word.toLowerCase().trim()).join("|")})\\b`)
          : null

      return cached({
        maxSize: EVENT_MUTE_CACHE_SIZE,
        getKey: ([event, strict = false]: [event: HashedEvent, strict?: boolean]) => `${event.id}:${strict}`,
        getValue: ([event, strict = false]: [event: HashedEvent, strict?: boolean]) => {
          if (!$pubkey || !event.pubkey) {
            return false
          }

          const {roots, replies} = getReplyTagValues(event.tags)

          if ([event.id, event.pubkey, ...roots, ...replies].some(
            entity => entity !== $pubkey && $userMutes.has(entity),
          )) {
            return true
          }

          if (mutedWordsRegex) {
            const contentToMatch = event.content?.toLowerCase() || ""
            const profileNameToMatch = displayProfileByPubkey(event.pubkey).toLowerCase()
            const nip05ToMatch = $profilesByPubkey.get(event.pubkey)?.nip05 || ""

            if (contentToMatch.match(mutedWordsRegex)) return true
            if (profileNameToMatch.match(mutedWordsRegex)) return true
            if (nip05ToMatch.match(mutedWordsRegex)) return true
          }

          if (strict || $userFollows.has(event.pubkey)) {
            return false
          }

          const wotScore = getUserWotScore(event.pubkey)
          const okWot = wotScore >= minWot
          const powDifficulty = Number(getTag("nonce", event.tags)?.[2] || "0")
          const isValidPow = getPow(event.id) >= powDifficulty
          const okPow = isValidPow && powDifficulty > minPow

          return !okWot && !okPow
        },
      })
    },
  ),
)

// Read receipts

export const checked = writable<Record<string, number>>({})

export const deriveChecked = (key: string) => derived(checked, prop(key))

export const getSeenAt = derived([checked], ([$checked]) => (path: string, event: TrustedEvent) => {
  const timestamp = max([$checked[path], $checked[path.split("/")[0] + "/*"], $checked["*"]])

  return timestamp >= event.created_at ? timestamp : 0
})

// Channels

export const getChannelId = (pubkeys: string[]) => sort(uniq(pubkeys)).join(",")

export const getChannelIdFromEvent = (event: TrustedEvent) =>
  getChannelId([event.pubkey, ...getPubkeyTagValues(event.tags)])

const DIRECT_MESSAGE_AND_CHANNEL_MESSAGE_KINDS = [4, DIRECT_MESSAGE]

export const messages = deriveEvents(repository, {
  filters: [{kinds: DIRECT_MESSAGE_AND_CHANNEL_MESSAGE_KINDS}],
})

export const channels = derived(
  [pubkey, messages, getSeenAt],
  ([$pubkey, $messages, $getSeenAt]) => {
    const channelsById: Record<string, Channel> = {}

    for (const event of $messages) {
      if (!getChannelIdFromEvent(event).includes($pubkey)) {
        continue
      }

      const channelId = getChannelIdFromEvent(event)
      const channel = channelsById[channelId] || {
        id: channelId,
        last_checked: 0,
        last_received: 0,
        last_sent: 0,
        messages: [],
      }

      channel.messages.push(event)
      channel.last_checked = Math.max(channel.last_checked, $getSeenAt("channels/" + channelId, event))

      if (event.pubkey === $pubkey) {
        channel.last_sent = Math.max(channel.last_sent, event.created_at)
      } else {
        channel.last_received = Math.max(channel.last_received, event.created_at)
      }

      channelsById[channelId] = channel
    }

    return sortBy(channel => -Math.max(channel.last_sent, channel.last_received), Object.values(channelsById))
  },
)

export const channelHasNewMessages = (channel: Channel) =>
  channel.last_received > Math.max(channel.last_sent, channel.last_checked)

export const hasNewMessages = derived(channels, $channels => $channels.some(channelHasNewMessages))

export const forceRelays = (relays: string[], forcedRelays: string[]) =>
  forcedRelays.length > 0 ? forcedRelays : relays

export const withRelays = (relays: string[], additionalRelays: string[]) =>
  uniq([...relays, ...additionalRelays])

export const forcePlatformRelays = (relays: string[]) => forceRelays(relays, env.PLATFORM_RELAYS)

export const withPlatformRelays = (relays: string[]) => withRelays(relays, env.PLATFORM_RELAYS)

export const withIndexers = (relays: string[]) => withRelays(relays, env.INDEXER_RELAYS)

// Lists

export const lists = deriveEventsMapped<PublishedUserList>(repository, {
  filters: [{kinds: EDITABLE_LIST_KINDS}],
  eventToItem: event => (event.tags.length > 1 ? readUserList(event) : null),
  itemToEvent: prop<TrustedEvent>("event"),
})

export const userLists = derived(
  [lists, pubkey],
  ([$lists, $pubkey]) =>
    sortBy(
      list => list.title.toLowerCase(),
      $lists.filter(list => list.event.pubkey === $pubkey),
    ),
)

export const listSearch = derived(lists, $lists => new UserListSearch($lists))

// Feeds

export const feeds = deriveEventsMapped<PublishedFeed>(repository, {
  filters: [{kinds: [FEED]}],
  itemToEvent: prop<TrustedEvent>("event"),
  eventToItem: readFeed,
})

export const userFeeds = derived([feeds, pubkey], ([$feeds, $pubkey]) =>
  $feeds.filter(feed => feed.event.pubkey === $pubkey),
)

export const feedFavoriteEvents = deriveEvents(repository, {filters: [{kinds: [FEEDS]}]})

export const feedFavorites = derived(
  [plaintext, feedFavoriteEvents],
  ([$plaintext, $feedFavoriteEvents]) =>
    $feedFavoriteEvents.map(event =>
      readList(
        asDecryptedEvent(event, {
          content: $plaintext[event.id],
        }),
      ),
    ),
)

export const feedFavoritesByAddress = withGetter(
  derived(feedFavorites, $feedFavorites => {
    const favoritesByAddress = new Map<string, PublishedList[]>()

    for (const list of $feedFavorites) {
      for (const address of getAddressTagValues(getListTags(list))) {
        pushToMapKey(favoritesByAddress, address, list)
      }
    }

    return favoritesByAddress
  }),
)

export const userFeedFavorites = derived(
  [feedFavorites, pubkey],
  ([$feedFavorites, $pubkey]) => $feedFavorites.find(list => list.event.pubkey === $pubkey),
)

export const userFavoritedFeeds = derived(userFeedFavorites, $list =>
  getAddressTagValues(getListTags($list))
    .map(repository.getEvent)
    .filter(identity)
    .map(readFeed),
)

export class FeedSearch extends SearchHelper<PublishedFeed, string> {
  getSearch = () => {
    const favoritesByAddress = feedFavoritesByAddress.get()
    const getScore = (feed: PublishedFeed) => favoritesByAddress.get(getAddress(feed.event))?.length || 0
    const options = this.options.map(feed => ({feed, score: getScore(feed)}))
    const fuse = new Fuse(options, {
      keys: ["feed.title", "feed.description"],
      shouldSort: false,
      includeScore: true,
    })

    return (term: string) => {
      if (!term) {
        return sortBy(item => -item.score, options).map(item => item.feed)
      }

      return sortBy(
        result => result.score - Math.pow(Math.max(0, result.item.score), 1 / 100),
        fuse.search(term),
      ).map(result => result.item.feed)
    }
  }

  getValue = (option: PublishedFeed) => getAddress(option.event)
  displayValue = (address: string) => displayFeed(this.getOption(address))
}

export const feedSearch = derived(feeds, $feeds => new FeedSearch($feeds))

export const listFeeds = deriveEventsMapped<PublishedListFeed>(repository, {
  eventToItem: event =>
    event.tags.length > 1 ? mapListToFeed(readUserList(event)) : undefined,
  filters: [{kinds: [NAMED_BOOKMARKS]}],
  itemToEvent: prop<TrustedEvent>("event"),
})

export const userListFeeds = derived(
  [listFeeds, pubkey],
  ([$listFeeds, $pubkey]) =>
    sortBy(
      feed => feed.title.toLowerCase(),
      $listFeeds.filter(feed => feed.list.event.pubkey === $pubkey),
    ),
)

// Handlers

export const handlers = derived(
  deriveEvents(repository, {filters: [{kinds: [HANDLER_INFORMATION]}]}),
  $events => $events.flatMap(readHandlers),
)

export const handlersByKind = derived(handlers, $handlers =>
  groupBy(handler => handler.kind, $handlers),
)

export const recommendations = deriveEvents(repository, {
  filters: [{kinds: [HANDLER_RECOMMENDATION]}],
})

export const recommendationsByHandlerAddress = derived(recommendations, $events =>
  groupBy(getHandlerAddress, $events),
)

export const deriveHandlersForKind = simpleCache(([kind]: [number]) =>
  derived([handlers, recommendationsByHandlerAddress], ([$handlers, $recommendationsByAddress]) =>
    sortBy(
      handler => -handler.recommendations.length,
      $handlers
        .filter(handler => handler.kind === kind)
        .map(handler => ({
          ...handler,
          recommendations: $recommendationsByAddress.get(getAddress(handler.event)) || [],
        })),
    ),
  ),
)

// Collections

export const collections = derived(
  deriveEvents(repository, {filters: [{kinds: [LABEL], "#L": ["#t"]}]}),
  readCollections,
)

export const deriveCollections = (currentPubkey: string) =>
  derived(collections, $collections =>
    sortBy(
      collection => collection.name.toLowerCase(),
      $collections.filter(collection => collection.pubkey === currentPubkey),
    ),
  )

export const collectionSearch = derived(
  collections,
  $collections => new CollectionSearch($collections),
)

// Network

const executorCache = new Map<string, Executor>()

export const getExecutor = (urls: string[]) => {
  const sortedUrlsKey = [...urls].map(normalizeRelayUrl).sort().join(",")

  if (executorCache.has(sortedUrlsKey)) {
    return executorCache.get(sortedUrlsKey)!
  }

  const [localUrls, remoteUrls] = partition(url => LOCAL_RELAY_URL === url, urls.map(normalizeRelayUrl))

  let target: Target = new Relays(remoteUrls.map(url => ctx.net.pool.get(url)))
  if (localUrls.length > 0) {
    target = new Multi([target, new Local(relay)])
  }

  target.setMaxListeners(20)
  const executor = new Executor(target)

  executorCache.set(sortedUrlsKey, executor)
  return executor
}

export type MySubscribeRequest = PartialSubscribeRequest & {
  forcePlatform?: boolean
  skipCache?: boolean
}

export const subscribe = ({forcePlatform, skipCache, ...request}: MySubscribeRequest) => {
  if (env.PLATFORM_RELAYS.length > 0 && forcePlatform !== false) {
    request.relays = env.PLATFORM_RELAYS
  }

  if (!skipCache && request.relays?.length > 0) {
    request.relays = [...request.relays, LOCAL_RELAY_URL]
  }

  return baseSubscribe(request)
}

export const load = (request: MySubscribeRequest) =>
  new Promise<TrustedEvent[]>(resolve => {
    const events: TrustedEvent[] = []
    const sub = subscribe({...request, closeOnEose: true})

    sub.on(SubscriptionEvent.Event, (_url, event) => events.push(event))
    sub.on(SubscriptionEvent.Complete, _url => resolve(events))
  })

export type MyPublishRequest = PublishRequest & {
  delay?: number
  forcePlatform?: boolean
}

export const publish = ({forcePlatform = true, ...request}: MyPublishRequest) => {
  request.relays = forcePlatform
    ? forcePlatformRelays(request.relays)
    : withPlatformRelays(request.relays)

  request.relays = uniq([...request.relays, LOCAL_RELAY_URL])

  logger.info("Publishing event", request)

  return publishThunk(request)
}

export type SignOptions = {anonymous?: boolean; sk?: string}

export const sign = (template: StampedEvent, opts: SignOptions = {}): Promise<SignedEvent> => {
  if (opts.anonymous) {
    return Nip01Signer.ephemeral().sign(template)
  }

  if (opts.sk) {
    return Nip01Signer.fromSecret(opts.sk).sign(template)
  }

  return signer.get().sign(template)
}

export type CreateAndPublishOpts = CreateAndPublishOptions & {
  anonymous?: boolean
  forcePlatform?: boolean
  sk?: string
}

type CreateAndPublishOptions = {
  content?: string
  created_at?: number
  kind: number
  relays: string[]
  tags?: string[][]
  timeout?: number
  verb?: "AUTH" | "EVENT"
}

export const createAndPublish = async ({
  kind,
  content = "",
  tags = [],
  created_at = now(),
  anonymous,
  sk,
  relays,
  timeout,
  verb,
  forcePlatform = true,
}: CreateAndPublishOpts) => {
  const eventTemplate = createEvent(kind, {content, tags, created_at})
  const signedEvent = await sign(eventTemplate, {anonymous, sk})

  return publish({event: signedEvent, relays, verb, timeout, forcePlatform})
}

const CLIENT_TAG_NAME = "client"

export const getClientTags = () => {
  if (!getSetting("enable_client_tag")) {
    return []
  }

  const {CLIENT_NAME = "", CLIENT_ID} = env
  const tag: string[] = [CLIENT_TAG_NAME, CLIENT_NAME]

  if (CLIENT_ID) {
    tag.push(CLIENT_ID)
  }

  return [tag]
}

export const addClientTags = <T extends Partial<EventTemplate>>({tags = [], ...event}: T) => ({
  ...event,
  tags: tags.filter(tag => tag[0] !== CLIENT_TAG_NAME).concat(getClientTags()),
})

// Storage

let ready: Promise<any> = Promise.resolve()

const STORAGE_VERSION = 3
const HOUR_IN_SECONDS = 60 * 60
const CUTOFF_TIME = now() - HOUR_IN_SECONDS
const EVENT_LIMIT = 30_000
const LARGE_EVENT_COUNT = 50_000
const MIGRATION_COOLDOWN = 60

const migrateFresh = ( data:{ key: string; value: number }[]) =>
  data.filter(({value}) => value > CUTOFF_TIME)


const getScoreEvent = () => {
  const ALWAYS_KEEP = Infinity
  const NEVER_KEEP = 0

  const $sessionKeys = new Set(Object.keys(sessions.get()))
  const $userFollows = get(userFollows)
  const $maxWot = get(maxWot)

  return (event: TrustedEvent) => {
    if (event.kind === FOLLOWS && !$userFollows.has(event.pubkey)) {
      return NEVER_KEEP
    }

    if ($sessionKeys.has(event.pubkey) || event.tags.some(tag => $sessionKeys.has(tag[1]))) {
      return ALWAYS_KEEP
    }

    if (event.wrap || event.kind === DIRECT_MESSAGE || event.kind === WRAP) {
      return NEVER_KEEP
    }
    if (repostKinds.includes(event.kind) || reactionKinds.includes(event.kind)) {
      return NEVER_KEEP
    }

    let score = $userFollows.has(event.pubkey) ? $maxWot : getUserWotScore(event.pubkey)

    if (noteKinds.includes(event.kind)) {
      score = (event.created_at / now()) * score
    }

    if (metaKinds.includes(event.kind)) {
      score *= 2
    }

    return score
  }
}

let lastMigrate = 0

const migrateEvents = (events: TrustedEvent[]) => {
  if (events.length < LARGE_EVENT_COUNT || ago(lastMigrate) < MIGRATION_COOLDOWN) {
    return events
  }

  events = events.filter(event => !event.wrap?.tags.some(tag => tag[1].startsWith("35834:")))

  lastMigrate = now()

  const scoreEvent = getScoreEvent()

  return take(
    EVENT_LIMIT,
    sortBy(event => -scoreEvent(event), events),
  )
}


if (!db) {
  const noticeVerbs = ["NOTICE", "CLOSED", "OK", "NEG-MSG"]
  const initialRelays = [
    ...env.DEFAULT_RELAYS,
    ...env.DVM_RELAYS,
    ...env.INDEXER_RELAYS,
    ...env.PLATFORM_RELAYS,
    ...env.SEARCH_RELAYS,
  ]

  setContext({
    net: getDefaultNetContext({getExecutor}),
    app: getDefaultAppContext({
      dufflepudUrl: env.DUFFLEPUD_URL,
      indexerRelays: env.INDEXER_RELAYS,
      requestTimeout: 10000,
      router: makeRouter({
        getLimit: () => getSetting("relay_limit"),
      }),
    }),
  })

  userSettings.subscribe($settings => {
    const autoAuthenticate = $settings.auto_authenticate || env.PLATFORM_RELAYS.length > 0

    ctx.net.authMode = autoAuthenticate ? AuthMode.Implicit : AuthMode.Explicit
    ctx.app.dufflepudUrl = getSetting("dufflepud_url")
  })

  ctx.net.pool.on("init", (connection: Connection) => {
    connection.on(ConnectionEvent.Receive, (_connection, args) => {
      const [verb, ...restArgs] = args
      if (!noticeVerbs.includes(verb)) return
      subscriptionNotices.update($notices => {
        pushToMapKey($notices, connection.url, {
          created_at: now(),
          notice: [verb, ...restArgs],
          url: connection.url,
        })
        return $notices
      })
    })
  })


  ready = initStorage("coracle", STORAGE_VERSION, {
    checked: storageAdapters.fromObjectStore(checked, {throttle: 3000}),
    freshness: storageAdapters.fromObjectStore(freshness, {
      migrate: migrateFresh,
      throttle: 3000,
    }),
    handles: storageAdapters.fromCollectionStore("nip05", handles, {throttle: 3000}),
    plaintext: storageAdapters.fromObjectStore(plaintext, {throttle: 3000}),
    relays: storageAdapters.fromCollectionStore("url", relays, {throttle: 3000}),
    repository: storageAdapters.fromRepository(repository, {migrate: migrateEvents, throttle: 3000}),
    zappers: storageAdapters.fromCollectionStore("lnurl", zappers, {throttle: 3000}),
  }).then(() => Promise.all(initialRelays.map(loadRelay)))
}

export {ready}
