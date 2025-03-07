import crypto from "crypto"
import {get} from "svelte/store"

import type {Session} from "@welshman/app"
import {
  follow as baseFollow,
  getRelayUrls,
  inboxRelaySelectionsByPubkey,
  nip46Perms,
  pubkey,
  repository,
  session,
  sessions,
  signer,
  subscribe,
  tagPubkey,
  unfollow as baseUnfollow,
  userInboxRelaySelections,
  userRelaySelections,
} from "@welshman/app"
import {DVMEvent, type DVMRequestOptions} from "@welshman/dvm"
import {
  append,
  assoc,
  cached,
  ctx,
  Emitter,
  fetchJson,
  flatten,
  groupBy,
  identity,
  now,
  nthNe,
  omit,
  prop,
  remove,
  sleep,
  tryCatch,
  uniq,
} from "@welshman/lib"
import {SubscriptionEvent} from "@welshman/net"
import {makeSecret, Nip01Signer, Nip46Broker, Nip59} from "@welshman/signer"
import type {EventTemplate, Filter, Profile, StampedEvent, TrustedEvent} from "@welshman/util"
import {
  Address,
  addToListPublicly,
  createEvent,
  createProfile,
  editProfile,
  FEEDS,
  FOLLOWS,
  getAddress,
  getTagValue,
  INBOX_RELAYS,
  isPublishedProfile,
  isSignedEvent,
  makeList,
  normalizeRelayUrl,
  PROFILE,
  RELAYS,
  removeFromList,
  uniqTags,
} from "@welshman/util"

import {
  addClientTags,
  anonymous,
  createAndPublish,
  getClientTags,
  publish,
  sign,
  userFeedFavorites,
  withIndexers,
} from "src/engine/state"
import {blobToFile, stripExifData} from "src/util/html"
import {joinPath} from "src/util/misc"
import {appDataKeys} from "src/util/nostr"
import logger from "src/util/logger"

// Helpers

export const updateRecord = <T extends Record<string, any>>(
  record: T | undefined,
  timestamp: number,
  updates: Partial<T>,
): T => {
  let updatedRecord = {...(record || {})}
  for (const [field, value] of Object.entries(updates)) {
    const tsField = `${field}_updated_at`
    const lastUpdated = updatedRecord[tsField] || -1

    if (timestamp > lastUpdated) {
      updatedRecord = {
        ...updatedRecord,
        [field]: value,
        [tsField]: timestamp,
        updated_at: Math.max(timestamp, updatedRecord.updated_at || 0),
      }
    }
  }

  return updatedRecord as T
}

export const updateStore = <T extends Record<string, any>>(
  store,
  timestamp: number,
  updates: Partial<T>,
) => store.update(currentRecord => updateRecord(currentRecord, timestamp, updates))

export const nip44EncryptToSelf = async (payload: string) =>
  signer.get().nip44.encrypt(pubkey.get(), payload)

// Files

const AUTH_REQUIRED_EVENT_KIND = 27235

export const nip98Fetch = async (url: string, method: string, body = null) => {
  const tags: string[][] = [
    ["u", url],
    ["method", method],
  ]

  if (body) {
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex")
    tags.push(["payload", payloadHash])
  }

  const currentSigner = signer.get() || Nip01Signer.ephemeral()
  const authEvent = await currentSigner.sign(createEvent(AUTH_REQUIRED_EVENT_KIND, {tags}))
  const auth = btoa(JSON.stringify(authEvent))
  const headers = {Authorization: `Nostr ${auth}`}

  try {
    const response = await fetchJson(url, {body, method, headers})
    return response
  } catch (error) {
    logger.error("NIP98 Fetch error", error)
    throw error
  }
}

const PROGRESS_EVENT_KIND = 7000
const DVM_REQUEST_RESULT_DELAY = 30_000
const DVM_POLL_INTERVAL = 3000
const DVM_MAX_POLL_TIME = 60

export const makeDvmRequest = (request: DVMRequestOptions & {delay?: number}) => {
  const emitter = new Emitter()
  const {
    event,
    relays,
    timeout = DVM_REQUEST_RESULT_DELAY,
    autoClose = true,
    reportProgress = true,
  } = request
  const resultKind = event.kind + 1000
  const kinds = reportProgress ? [resultKind, PROGRESS_EVENT_KIND] : [resultKind]
  const filters: Filter[] = [{kinds, since: now() - 60, "#e": [event.id]}]

  const sub = subscribe({relays, timeout, filters})
  const thunk = publish({event, relays, timeout, delay: request.delay})

  sub.on(SubscriptionEvent.Event, (_url: string, event: TrustedEvent) => {
    if (event.kind === PROGRESS_EVENT_KIND) {
      emitter.emit(DVMEvent.Progress, _url, event)
    } else {
      emitter.emit(DVMEvent.Result, _url, event)
      if (autoClose) {
        sub.close()
      }
    }
  })
  return {request, emitter, sub, thunk}
}

const MEDIA_PROVIDER_CACHE_SIZE = 10

export const getMediaProviderURL = cached({
  maxSize: MEDIA_PROVIDER_CACHE_SIZE,
  getKey: ([url]) => url,
  getValue: ([url]) => fetchMediaProviderURL(url),
})

const fetchMediaProviderURL = async (host: string) =>
  prop("api_url")(await fetchJson(joinPath(host, ".well-known/nostr/nip96.json")))

const fileToFormData = (file: File) => {
  const formData = new FormData()
  formData.append("file[]", file)
  return formData
}

export const uploadFileToHost = async <T = any>(url: string, file: File): Promise<T> => {
  const startTime = now()
  const apiUrl = <string>await getMediaProviderURL(url)
  let response

  try {
    response = await nip98Fetch(apiUrl, "POST", fileToFormData(file))
  } catch (error) {
    logger.error("File upload to host failed", error)
    throw error
  }

  while (response.processing_url) {
    try {
      const {status, nip94_event} = await nip98Fetch(response.processing_url, "GET")
      if (status === "success") {
        return nip94_event
      }
    } catch (error) {
      logger.error("Error fetching processing URL", error)
      break
    }

    if (now() - startTime > DVM_MAX_POLL_TIME) {
      logger.warn("Timeout waiting for media processing")
      break
    }

    await sleep(DVM_POLL_INTERVAL)
  }

  return response.nip94_event
}

export const uploadFilesToHost = <T = any>(url: string, files: File[]): Promise<T[]> =>
  Promise.all(files.map(file => tryCatch(async () => await uploadFileToHost<T>(url, file))))

export const uploadFileToHosts = <T = any>(urls: string[], file: File): Promise<T[]> =>
  Promise.all(urls.map(url => tryCatch(async () => await uploadFileToHost<T>(url, file))))

export const uploadFilesToHosts = async <T = any>(urls: string[], files: File[]): Promise<T[]> =>
  flatten(await Promise.all(urls.map(url => uploadFilesToHost<T>(url, files)))).filter(identity)

const WEBP_MIME_TYPE_REGEX = /image\/(webp|gif)/

export const compressFiles = (files: File[], opts: any) =>
  Promise.all(
    files.map(async file => {
      if (file.type.match(WEBP_MIME_TYPE_REGEX)) {
        return file
      }
      return blobToFile(await stripExifData(file, opts))
    }),
  )

export const eventsToMeta = (events: TrustedEvent[]) => {
  const tagsByHash = groupBy(
    metaEvent => getTagValue("ox", metaEvent),
    events.map(e => e.tags),
  )
  return uniqTags(Array.from(tagsByHash.values()).flatMap(identity).flatMap(identity))
}

export const uploadFiles = async (urls: string[], files: File[], compressorOpts = {}) => {
  const compressedFiles = await compressFiles(files, compressorOpts)
  const nip94Events = await uploadFilesToHosts(urls, compressedFiles)
  return eventsToMeta(nip94Events as TrustedEvent[])
}

// Key state management

export const signAndPublish = async (template: StampedEvent, {anonymous = false} = {}) => {
  const event = await sign(template, {anonymous})
  const relays = ctx.app.router.PublishEvent(event).getUrls()
  return publish({event, relays})
}

// Deletes

export const publishDeletion = ({kind, address = null, id = null}) => {
  const tags: string[][] = [["k", String(kind)]]

  if (address) tags.push(["a", address])

  if (id) tags.push(["e", id])

  return createAndPublish({
    tags,
    kind: 5,
    relays: ctx.app.router.FromUser().getUrls(),
    forcePlatform: false,
  })
}

export const deleteEvent = (event: TrustedEvent) =>
  publishDeletion({id: event.id, address: getAddress(event), kind: event.kind})

export const deleteEventByAddress = (address: string) =>
  publishDeletion({address, kind: Address.from(address).kind})

// Profile

export const publishProfile = (profile: Profile, {forcePlatform = false} = {}) => {
  const relays = withIndexers(ctx.app.router.FromUser().getUrls())
  const template = isPublishedProfile(profile) ? editProfile(profile) : createProfile(profile)

  return createAndPublish({...addClientTags(template), relays, forcePlatform})
}

// Follows

export const unfollow = async (value: string) =>
  signer.get()
    ? baseUnfollow(value)
    : anonymous.update($anon => ({...$anon, follows: $anon.follows.filter(nthNe(1, value))}))

export const follow = async (tag: string[]) =>
  signer.get()
    ? baseFollow(tag)
    : anonymous.update($anon => ({...$anon, follows: append(tag, $anon.follows)}))

// Feed favorites

export const removeFeedFavorite = async (address: string) => {
  const list = get(userFeedFavorites) || makeList({kind: FEEDS})
  const template = await removeFromList(list, address).reconcile(nip44EncryptToSelf)

  return createAndPublish({...template, relays: ctx.app.router.FromUser().getUrls()})
}

export const addFeedFavorite = async (address: string) => {
  const list = get(userFeedFavorites) || makeList({kind: FEEDS})
  const template = await addToListPublicly(list, ["a", address]).reconcile(nip44EncryptToSelf)

  return createAndPublish({...template, relays: ctx.app.router.FromUser().getUrls()})
}

// Relays

export const requestRelayAccess = async (url: string, claim: string) =>
  createAndPublish({
    kind: 28934,
    forcePlatform: false,
    tags: [["claim", claim]],
    relays: [url],
  })

type ModifyTagsFn = (tags: string[][]) => string[][]

export const setOutboxPolicies = async (modifyTags: ModifyTagsFn) => {
  if (signer.get()) {
    const list = get(userRelaySelections) || makeList({kind: RELAYS})

    createAndPublish({
      kind: list.kind,
      content: list.event?.content || "",
      tags: modifyTags(list.publicTags),
      relays: withIndexers(ctx.app.router.FromUser().getUrls()),
    })
  } else {
    anonymous.update($anon => ({...$anon, relays: modifyTags($anon.relays)}))
  }
}

export const setInboxPolicies = async (modifyTags: ModifyTagsFn) => {
  const list = get(userInboxRelaySelections) || makeList({kind: INBOX_RELAYS})

  createAndPublish({
    kind: list.kind,
    content: list.event?.content || "",
    tags: modifyTags(list.publicTags),
    relays: withIndexers(ctx.app.router.FromUser().getUrls()),
  })
}

export const setInboxPolicy = (url: string, enabled: boolean) => {
  const urls = getRelayUrls(inboxRelaySelectionsByPubkey.get().get(pubkey.get()))
  const isPolicySet = urls.includes(url)

  if (enabled || isPolicySet) {
    setInboxPolicies($tags => {
      return $tags
        .filter(t => normalizeRelayUrl(t[1]) !== url)
        .concat(enabled ? [["relay", url]] : [])
    })
  }
}

export const setOutboxPolicy = (url: string, read: boolean, write: boolean) => {
  setOutboxPolicies($tags => {
    let filteredTags = $tags.filter(t => normalizeRelayUrl(t[1]) !== url)
    if (read && write) {
      filteredTags = filteredTags.concat([["r", url]])
    } else if (read) {
      filteredTags = filteredTags.concat([["r", url, "read"]])
    } else if (write) {
      filteredTags = filteredTags.concat([["r", url, "write"]])
    }
    return filteredTags
  })
}

export const leaveRelay = async (url: string) => {
  await Promise.all([setInboxPolicy(url, false), setOutboxPolicy(url, false, false)])

  if (pubkey.get()) {
    broadcastUserData([url])
  }
}

export const joinRelay = async (url: string, claim?: string) => {
  url = normalizeRelayUrl(url)

  if (claim && signer.get()) {
    await requestRelayAccess(url, claim)
  }

  await setOutboxPolicy(url, true, true)

  if (pubkey.get()) {
    broadcastUserData([url])
  }
}

const DIRECT_MESSAGE_KIND = 14

export const sendMessage = async (channelId: string, content: string, delay: number) => {
  const recipients = channelId.split(",")
  const template = {
    content,
    kind: DIRECT_MESSAGE_KIND,
    created_at: now(),
    tags: [...remove(pubkey.get(), recipients).map(tagPubkey), ...getClientTags()],
  }

  for (const recipient of uniq([pubkey.get(), ...recipients])) {
    const helper = Nip59.fromSigner(signer.get())
    const rumor = await helper.wrap(recipient, template)

    repository.publish(rumor)

    publish({
      event: rumor.wrap,
      relays: ctx.app.router.PubkeyInbox(recipient).getUrls(),
      forcePlatform: false,
      delay,
    })
  }
}

// Session/login

const addSession = (s: Session) => {
  sessions.update(allSessions => assoc(s.pubkey, s)(allSessions))
  pubkey.set(s.pubkey)
}

export const loginWithPublicKey = (publicKey: string) =>
  addSession({method: "pubkey", pubkey: publicKey})

export const loginWithNip07 = (publicKey: string) =>
  addSession({method: "nip07", pubkey: publicKey})

export const loginWithNip55 = (publicKey: string, pkg: any) =>
  addSession({method: "nip55", pubkey: publicKey, signer: pkg})

export type Nip46LoginArgs = {
  relays: string[]
  signerPubkey: string
  clientSecret?: string
  connectSecret?: string
}

export const loginWithNip46 = async ({
  relays,
  signerPubkey,
  clientSecret = makeSecret(),
  connectSecret = "",
}: Nip46LoginArgs) => {
  const broker = Nip46Broker.get({relays, clientSecret, signerPubkey})
  const result = await broker.connect(connectSecret, nip46Perms)

  if (!["ack", connectSecret].includes(result)) return false

  const publicKey = await broker.getPublicKey()

  if (!publicKey) return false

  const handler = {relays, pubkey: signerPubkey}

  addSession({method: "nip46", pubkey: publicKey, secret: clientSecret, handler})

  return true
}

export const logoutPubkey = (publicKey: string) => {
  if (session.get().pubkey === publicKey) {
    throw new Error("Cannot destroy the current session, use logout instead")
  }

  sessions.update(allSessions => omit([publicKey], allSessions))
}

export const logout = () => {
  pubkey.set(null)
  sessions.set({})
}

export const setAppData = async <T = any>(dataKey: string, data: T) => {
  if (signer.get()) {
    return createAndPublish({
      kind: 30078,
      tags: [["d", dataKey]],
      content: await signer.get().nip04.encrypt(session.get().pubkey, JSON.stringify(data)),
      relays: ctx.app.router.FromUser().getUrls(),
      forcePlatform: false,
    })
  }
}

export const publishSettings = ($settings: Record<string, any>) =>
  setAppData(appDataKeys.USER_SETTINGS, $settings)

export const broadcastUserData = async (relays: string[]) => {
  const authors = [pubkey.get()]
  const kinds = [RELAYS, INBOX_RELAYS, FOLLOWS, PROFILE]
  for (const event of repository.query([{kinds, authors}])) {
    if (isSignedEvent(event)) publish({event, relays, forcePlatform: false})
  }
}
