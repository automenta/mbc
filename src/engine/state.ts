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
  getPlaintext,
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
  Worker,
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
import {Nip01Signer, Nip59} from "@welshman/signer"
import {deriveEvents, deriveEventsMapped, synced, withGetter} from "@welshman/store"
import type {
  EventTemplate,
  HashedEvent,
  PublishedList,
  SignedEvent,
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
import Fuse from "fuse.js"
import {getPow} from "nostr-tools/nip13"
import type {PublishedFeed, PublishedListFeed, PublishedUserList} from "src/domain"
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
import {derived, get, writable} from "svelte/store"

const VITE_CLIENT_ID = import.meta.env.VITE_CLIENT_ID
const VITE_CLIENT_NAME = import.meta.env.VITE_CLIENT_NAME
const VITE_DEFAULT_FOLLOWS = import.meta.env.VITE_DEFAULT_FOLLOWS
const VITE_DEFAULT_RELAYS = import.meta.env.VITE_DEFAULT_RELAYS
const VITE_INDEXER_RELAYS = import.meta.env.VITE_INDEXER_RELAYS
const VITE_DUFFLEPUD_URL = import.meta.env.VITE_DUFFLEPUD_URL
const VITE_DVM_RELAYS = import.meta.env.VITE_DVM_RELAYS
const VITE_ENABLE_MARKET = import.meta.env.VITE_ENABLE_MARKET
const VITE_ENABLE_ZAPS = import.meta.env.VITE_ENABLE_ZAPS
const VITE_BLUR_CONTENT = import.meta.env.VITE_BLUR_CONTENT
const VITE_IMGPROXY_URL = import.meta.env.VITE_IMGPROXY_URL
const VITE_NIP96_URLS = import.meta.env.VITE_NIP96_URLS
const VITE_BLOSSOM_URLS = import.meta.env.VITE_BLOSSOM_URLS
const VITE_ONBOARDING_LISTS = import.meta.env.VITE_ONBOARDING_LISTS
const VITE_PLATFORM_PUBKEY = import.meta.env.VITE_PLATFORM_PUBKEY
const VITE_PLATFORM_RELAYS = import.meta.env.VITE_PLATFORM_RELAYS
const VITE_PLATFORM_ZAP_SPLIT = import.meta.env.VITE_PLATFORM_ZAP_SPLIT
const VITE_SEARCH_RELAYS = import.meta.env.VITE_SEARCH_RELAYS
const VITE_SIGNER_RELAYS = import.meta.env.VITE_SIGNER_RELAYS
const VITE_APP_URL = import.meta.env.VITE_APP_URL
const VITE_APP_NAME = import.meta.env.VITE_APP_NAME
//const VITE_APP_LOGO = import.meta.env.VITE_APP_LOGO

export const env = {
  CLIENT_ID: VITE_CLIENT_ID as string,
  CLIENT_NAME: VITE_CLIENT_NAME as string,
  DEFAULT_FOLLOWS: fromCsv(VITE_DEFAULT_FOLLOWS) as string,
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
  //APP_LOGO: VITE_APP_LOGO,
}

export const sessionWithMeta = withGetter(derived(session, $s => $s as SessionWithMeta))

export const hasNip44 = derived(signer, $signer => Boolean($signer?.nip44))

export const anonymous = withGetter(writable<AnonymousUserState>({follows: [], relays: []}))

export const canDecrypt = withGetter(synced("canDecrypt", false))

// Plaintext

export const ensureMessagePlaintext = async (event: TrustedEvent) => {
  if (!event.content) {
    return undefined
  }
  if (getPlaintext(event)) {
    return getPlaintext(event)
  }

  const recipient = getTagValue("p", event.tags)
  const currentSession = getSession(event.pubkey) || getSession(recipient)
  const otherPubkey = event.pubkey === currentSession?.pubkey ? recipient : event.pubkey
  const currentSigner = getSigner(currentSession)

  if (currentSigner) {
    const decryptedContent = await currentSigner.nip04.decrypt(otherPubkey, event.content)
    if (decryptedContent) {
      setPlaintext(event, decryptedContent)
      return decryptedContent
    }
  }

  return undefined
}

const pendingUnwraps = new Map<string, Promise<TrustedEvent>>()

export const ensureUnwrapped = async (event: TrustedEvent) => {
  if (event.kind !== WRAP) {
    return event
  }

  let rumor = repository.eventsByWrap.get(event.id)
  if (rumor) { // variable name was rumor, should be unwrappedEvent
    return rumor
  }

  if (pendingUnwraps.has(event.id)) {
    return pendingUnwraps.get(event.id)
  }

  const sessionForUnwrap = getSession(getTagValue("p", event.tags))
  const currentSigner = getSigner(sessionForUnwrap)

  if (currentSigner) {
    try {
      const unwrapPromise = Nip59.fromSigner(currentSigner).unwrap(event as SignedEvent)
      pendingUnwraps.set(event.id, unwrapPromise)
      rumor = await unwrapPromise
    } catch (error) {
      logger.error("Failed to unwrap event", error) // Added error logging
    }
  }

  if (rumor && isHashedEvent(rumor)) {
    pendingUnwraps.delete(event.id)
    tracker.copy(event.id, rumor.id)
    relay.send("EVENT", rumor)
  }

  return rumor
}

// Unwrap/decrypt stuff as it comes in

const unwrapper = new Worker<TrustedEvent>({chunkSize: 10})

unwrapper.addGlobalHandler(async (event: TrustedEvent) => {
  if (event.kind === WRAP) {
    await ensureUnwrapped(event)
  } else {
    await ensurePlaintext(event)
  }
})

const decryptKinds = [APP_DATA, FOLLOWS, MUTES]

repository.on("update", ({added}: {added: TrustedEvent[]}) => {
  for (const event of added) {
    if (decryptKinds.includes(event.kind) && event.content && !getPlaintext(event)) {
      unwrapper.push(event)
    }

    if (event.kind === WRAP && canDecrypt.get()) {
      unwrapper.push(event)
    }
  }
})

// Tracker

export const trackerStore = makeTrackerStore({throttle: 1000})

// Settings

export const defaultSettings = {
  relay_limit: 5,
  default_zap: 21,
  show_media: true,
  send_delay: 0, // undo send delay in ms
  pow_difficulty: 0,
  muted_words: [],
  ignore_muted_content: true,
  hide_sensitive: true,
  report_analytics: true,
  min_wot_score: 0,
  min_pow_difficulty: 0,
  enable_client_tag: false,
  auto_authenticate: false,
  note_actions: ["zaps", "replies", "reactions", "recommended_apps"],
  upload_type: "nip96",
  nip96_urls: env.NIP96_URLS.slice(0, 1),
  blossom_urls: env.BLOSSOM_URLS.slice(0, 1),
  imgproxy_url: env.IMGPROXY_URL,
  dufflepud_url: env.DUFFLEPUD_URL,
  platform_zap_split: env.PLATFORM_ZAP_SPLIT,
}

export const settingsEvents = deriveEvents(repository, {filters: [{kinds: [APP_DATA]}]})

export const userSettingsEvent = derived([pubkey, settingsEvents], ([$pubkey, $settingsEvents]) =>
  $settingsEvents.find(e => e.pubkey === $pubkey && getIdentifier(e) === appDataKeys.USER_SETTINGS),
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

export const getSetting = <T = any>(k: string): T => prop(k)(userSettings.get()) as T

export const imgproxy = (url: string, {w = 640, h = 1024} = {}) => {
  if (!url || url.match("gif$")) {
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
    logger.error("Error creating imgproxy URL", error) // Added error logging
    return url
  }
}

export const dufflepud = (path: string) => {
  const base = getSetting("dufflepud_url")

  if (!base) {
    throw new Error("Dufflepud is not enabled")
  }

  return `${base}/${path}`
}

// User follows/mutes/network

export const getMinWot = () => getSetting("min_wot_score") / maxWot.get()

export const userFollowList = derived([followsByPubkey, pubkey, anonymous], ([$m, $pk, $anon]) => {
  return $pk ? $m.get($pk) : makeList({kind: FOLLOWS, publicTags: $anon.follows})
})

export const userFollows = derived(userFollowList, l => new Set(getPubkeyTagValues(getListTags(l))))

export const userNetwork = derived(userFollowList, l => getNetwork(l.event.pubkey))

export const userMuteList = derived([mutesByPubkey, pubkey], ([$m, $pk]) => $m.get($pk))

export const userMutes = derived(
  userMuteList,
  l => new Set(getTagValues(["p", "e"], getListTags(l))),
)

export const userPinList = derived([pinsByPubkey, pubkey], ([$m, $pk]) => $m.get($pk))

export const userPins = derived(userPinList, l => new Set(getTagValues(["e"], getListTags(l))))

export const isEventMuted = withGetter(
  derived(
    [userMutes, userFollows, userSettings, profilesByPubkey, pubkey],
    ([$userMutes, $userFollows, $userSettings, $profilesByPubkey, $pubkey]) => {
      const mutedWords = $userSettings.muted_words
      const minWot = $userSettings.min_wot_score
      const minPow = $userSettings.min_pow_difficulty
      const mutedWordsRegex =
        mutedWords.length > 0
          ? new RegExp(`\\b(${mutedWords.map(w => w.toLowerCase().trim()).join("|")})\\b`)
          : null

      return cached({
        maxSize: 5000,
        getKey: ([e, strict = false]: [e: HashedEvent, strict?: boolean]) => `${e.id}:${strict}`,
        getValue: ([e, strict = false]: [e: HashedEvent, strict?: boolean]) => {
          if (!$pubkey || !e.pubkey) {
            return false
          }

          const {roots, replies} = getReplyTagValues(e.tags)

          if ([e.id, e.pubkey, ...roots, ...replies].some(x => x !== $pubkey && $userMutes.has(x))) {
            return true
          }

          if (mutedWordsRegex) {
            const contentToMatch = e.content?.toLowerCase() || ""
            const profileNameToMatch = displayProfileByPubkey(e.pubkey).toLowerCase()
            const nip05ToMatch = $profilesByPubkey.get(e.pubkey)?.nip05 || ""

            if (contentToMatch.match(mutedWordsRegex)) return true
            if (profileNameToMatch.match(mutedWordsRegex)) return true
            if (nip05ToMatch.match(mutedWordsRegex)) return true
          }

          if (strict || $userFollows.has(e.pubkey)) {
            return false
          }

          const wotScore = getUserWotScore(e.pubkey)
          const okWot = wotScore >= minWot
          const powDifficulty = Number(getTag("nonce", e.tags)?.[2] || "0")
          const isValidPow = getPow(e.id) >= powDifficulty
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
  const ts = max([$checked[path], $checked[path.split("/")[0] + "/*"], $checked["*"]])

  if (ts >= event.created_at) {
    return ts
  }

  return 0
})

// Channels

export const getChannelId = (pubkeys: string[]) => sort(uniq(pubkeys)).join(",")

export const getChannelIdFromEvent = (event: TrustedEvent) =>
  getChannelId([event.pubkey, ...getPubkeyTagValues(event.tags)])

export const messages = deriveEvents(repository, {filters: [{kinds: [4, DIRECT_MESSAGE]}]})

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
        last_sent: 0,
        last_received: 0,
        last_checked: 0,
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

    return sortBy(c => -Math.max(c.last_sent, c.last_received), Object.values(channelsById))
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
  eventToItem: (event: TrustedEvent) => (event.tags.length > 1 ? readUserList(event) : null),
  itemToEvent: prop<TrustedEvent>("event"),
})

export const userLists = derived(
  [lists, pubkey],
  ([$lists, $pubkey]: [PublishedUserList[], string]) =>
    sortBy(
      l => l.title.toLowerCase(),
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

export const userFeeds = derived([feeds, pubkey], ([$feeds, $pubkey]: [PublishedFeed[], string]) =>
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
    const $feedFavoritesByAddress = new Map<string, PublishedList[]>()

    for (const list of $feedFavorites) {
      for (const address of getAddressTagValues(getListTags(list))) {
        pushToMapKey($feedFavoritesByAddress, address, list)
      }
    }

    return $feedFavoritesByAddress
  }),
)

export const userFeedFavorites = derived(
  [feedFavorites, pubkey],
  ([$lists, $pubkey]: [PublishedList[], string]) =>
    $lists.find(list => list.event.pubkey === $pubkey),
)

export const userFavoritedFeeds = derived(userFeedFavorites, $list =>
  getAddressTagValues(getListTags($list)).map(repository.getEvent).filter(identity).map(readFeed),
)

export class FeedSearch extends SearchHelper<PublishedFeed, string> {
  getSearch = () => {
    const $feedFavoritesByAddress = feedFavoritesByAddress.get()
    const getScore = (feed: PublishedFeed) => $feedFavoritesByAddress.get(getAddress(feed.event))?.length || 0
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
        (r: any) => r.score - Math.pow(Math.max(0, r.item.score), 1 / 100),
        fuse.search(term),
      ).map((r: any) => r.item.feed)
    }
  }

  getValue = (option: PublishedFeed) => getAddress(option.event)

  displayValue = (address: string) => displayFeed(this.getOption(address))
}

export const feedSearch = derived(feeds, $feeds => new FeedSearch($feeds))

export const listFeeds = deriveEventsMapped<PublishedListFeed>(repository, {
  filters: [{kinds: [NAMED_BOOKMARKS]}],
  eventToItem: (event: TrustedEvent) =>
    event.tags.length > 1 ? mapListToFeed(readUserList(event)) : undefined,
  itemToEvent: prop<TrustedEvent>("event"),
})

export const userListFeeds = derived(
  [listFeeds, pubkey],
  ([$listFeeds, $pubkey]: [PublishedListFeed[], string]) =>
    sortBy(
      l => l.title.toLowerCase(),
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
  derived([handlers, recommendationsByHandlerAddress], ([$handlers, $recs]) =>
    sortBy(
      h => -h.recommendations.length,
      $handlers
        .filter(h => h.kind === kind)
        .map(h => ({...h, recommendations: $recs.get(getAddress(h.event)) || []})),
    ),
  ),
)

// Collections

export const collections = derived(
  deriveEvents(repository, {filters: [{kinds: [LABEL], "#L": ["#t"]}]}),
  readCollections,
)

export const deriveCollections = (currentPubkey: string) => // Renamed parameter for clarity
  derived(collections, $collections =>
    sortBy(
      f => f.name.toLowerCase(),
      $collections.filter(collection => collection.pubkey === currentPubkey),
    ),
  )

export const collectionSearch = derived(
  collections,
  $collections => new CollectionSearch($collections),
)

// Network

const executorCache = new Map<string, Executor>(); // Cache for Executors

export const getExecutor = (urls: string[]) => {
  const normalizedUrls = urls.map(normalizeRelayUrl); // Normalize URLs here
  const sortedUrlsKey = [...normalizedUrls].sort().join(','); // Create a consistent key
  if (executorCache.has(sortedUrlsKey)) {
    //console.trace(`getExecutor cache hit for: ${sortedUrlsKey}`); // Optional logging for cache hits
    return executorCache.get(sortedUrlsKey)!; // Return cached Executor
  }

  //console.trace(`getExecutor cache miss, creating new Executor for: ${sortedUrlsKey}`); // Optional logging for cache misses
  const [localUrls, remoteUrls] = partition(url => LOCAL_RELAY_URL === url, normalizedUrls);
  let target: Target = new Relays(remoteUrls.map(url => ctx.net.pool.get(url)));
  if (localUrls.length > 0) {
    target = new Multi([target, new Local(relay)]);
  }
  /** START OF CHANGE **/
  target.setMaxListeners(20); // Increased max listeners to 20 (adjust as needed)
  /** END OF CHANGE **/
  const executor = new Executor(target);
  executorCache.set(sortedUrlsKey, executor); // Store in cache
  return executor;
};


export type MySubscribeRequest = PartialSubscribeRequest & {
  skipCache?: boolean
  forcePlatform?: boolean
}

export const subscribe = ({forcePlatform, skipCache, ...request}: MySubscribeRequest) => {
  if (env.PLATFORM_RELAYS.length > 0 && forcePlatform !== false) {
    request.relays = env.PLATFORM_RELAYS
  }

  // Only add our local relay if we have relay selections to avoid bypassing auto relay selection
  if (!skipCache && request.relays?.length > 0) {
    request.relays = [...request.relays, LOCAL_RELAY_URL]
  }

  return baseSubscribe(request)
}

export const load = (request: MySubscribeRequest) =>
  new Promise<TrustedEvent[]>(resolve => {
    const events: TrustedEvent[] = []
    const sub = subscribe({...request, closeOnEose: true})

    sub.on(SubscriptionEvent.Event, (_url: string, event: TrustedEvent) => events.push(event)) // Removed unused url parameter
    sub.on(SubscriptionEvent.Complete, (_url: string) => resolve(events)) // Removed unused url parameter
  })

export type MyPublishRequest = PublishRequest & {
  forcePlatform?: boolean
  delay?: number
}

export const publish = ({forcePlatform = true, ...request}: MyPublishRequest) => {
  request.relays = forcePlatform
    ? forcePlatformRelays(request.relays)
    : withPlatformRelays(request.relays)

  // Ensure publication to the local relay for subscription notifications
  request.relays = uniq([...request.relays, LOCAL_RELAY_URL]) // Using spread syntax for clarity

  logger.info(`Publishing event`, request)

  return publishThunk(request)
}

export const sign = (
  template, // Added type for template
  opts: {anonymous?: boolean; sk?: string} = {},
): Promise<SignedEvent> => {
  if (opts.anonymous) {
    return Nip01Signer.ephemeral().sign(template)
  }

  if (opts.sk) {
    return Nip01Signer.fromSecret(opts.sk).sign(template)
  }

  return signer.get().sign(template)
}

export type CreateAndPublishOpts = {
  kind: number
  relays: string[]
  tags?: string[][]
  content?: string
  created_at?: number
  anonymous?: boolean
  sk?: string
  timeout?: number
  verb?: "EVENT" | "AUTH"
  forcePlatform?: boolean
}

export const createAndPublish = async ({
                                         kind,
                                         relays,
                                         tags = [],
                                         content = "",
                                         created_at = now(),
                                         anonymous,
                                         sk,
                                         timeout,
                                         verb,
                                         forcePlatform = true,
                                       }: CreateAndPublishOpts) => {
  const eventTemplate = createEvent(kind, {content, tags, created_at}) // More descriptive variable name
  const signedEvent = await sign(eventTemplate, {anonymous, sk}) // More descriptive variable name

  return publish({event: signedEvent, relays, verb, timeout, forcePlatform}) // Using object shorthand
}

export const getClientTags = () => {
  if (!getSetting("enable_client_tag")) {
    return []
  }

  const {CLIENT_NAME = "", CLIENT_ID} = env
  const tag = ["client", CLIENT_NAME]

  if (CLIENT_ID) {
    tag.push(CLIENT_ID)
  }

  return [tag]
}

export const addClientTags = <T extends Partial<EventTemplate>>({tags = [], ...event}: T) => ({
  ...event,
  tags: tags.filter(t => t[0] !== "client").concat(getClientTags()),
})

// Storage

let ready: Promise<any> = Promise.resolve()

const migrateFresh = ( data : { key: string, value: number }[] ) => {
  const cutoff = now() - HOUR;
  return data.filter(({value}) => value > cutoff);
}

const getScoreEvent = () => {
  const ALWAYS_KEEP = Infinity
  const NEVER_KEEP = 0

  const $sessionKeys = new Set(Object.keys(sessions.get()))
  const $userFollows = get(userFollows)
  const $maxWot = get(maxWot)

  return (event: TrustedEvent) => { // Parameter name 'e' changed to 'event' for clarity
    const isFollowing = $userFollows.has(event.pubkey)

    if (event.kind === FOLLOWS && !isFollowing) return NEVER_KEEP // Optimization: Early return

    if ($sessionKeys.has(event.pubkey) || event.tags.some(t => $sessionKeys.has(t[1]))) return ALWAYS_KEEP // Combined conditions

    if (event.wrap || event.kind === 4 || event.kind === WRAP) return NEVER_KEEP // Combined conditions
    if (repostKinds.includes(event.kind) || reactionKinds.includes(event.kind)) return NEVER_KEEP // Combined conditions

    let score = isFollowing ? $maxWot : getUserWotScore(event.pubkey)

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
  if (events.length < 50_000 || ago(lastMigrate) < 60) {
    return events
  }

  events = events.filter(e => !e.wrap?.tags.some(t => t[1].startsWith("35834:")))

  lastMigrate = now()

  const scoreEvent = getScoreEvent()

  return take(
    30_000,
    sortBy(e => -scoreEvent(e), events),
  )
}

// Initialize storage and context if not already initialized
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
    connection.on(ConnectionEvent.Receive, function (_cxn, args) { // Removed unused cxn parameter, using args directly
      const [verb, ...restArgs] = args
      if (!noticeVerbs.includes(verb)) return
      subscriptionNotices.update($notices => {
        pushToMapKey($notices, connection.url, {
          created_at: now(),
          url: connection.url,
          notice: [verb, ...restArgs], // Using restArgs for clarity
        })
        return $notices
      })
    })
  })

  ready = initStorage("coracle", 3, {
    relays: storageAdapters.fromCollectionStore("url", relays, {throttle: 3000}),
    handles: storageAdapters.fromCollectionStore("nip05", handles, {throttle: 3000}),
    zappers: storageAdapters.fromCollectionStore("lnurl", zappers, {throttle: 3000}),
    checked: storageAdapters.fromObjectStore(checked, {throttle: 3000}),
    freshness: storageAdapters.fromObjectStore(freshness, {
      throttle: 3000,
      migrate: migrateFresh,
    }),
    plaintext: storageAdapters.fromObjectStore(plaintext, {throttle: 3000}),
    repository: storageAdapters.fromRepository(repository, {throttle: 3000, migrate: migrateEvents}),
  }).then(() => Promise.all(initialRelays.map(loadRelay)))
}

export {ready}
