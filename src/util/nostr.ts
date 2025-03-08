import {avg, last, nthEq} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {
  Address,
  BOOKMARKS,
  CHANNELS,
  COMMENT,
  COMMUNITIES,
  FEED,
  FOLLOWS,
  fromNostrURI,
  GENERIC_REPOST,
  getParentIdOrAddr,
  getTags,
  getTagValue,
  GROUPS,
  HIGHLIGHT,
  INBOX_RELAYS,
  LONG_FORM,
  MUTES,
  NAMED_ARTIFACTS,
  NAMED_COMMUNITIES,
  NAMED_CURATIONS,
  NAMED_EMOJIS,
  NAMED_PEOPLE,
  NAMED_RELAYS,
  NAMED_TOPICS,
  NAMED_WIKI_AUTHORS,
  NAMED_WIKI_RELAYS,
  NOTE,
  PICTURE_NOTE,
  PINS,
  PROFILE,
  REACTION,
  RELAYS,
  REPOST,
  TOPICS,
  ZAP_RESPONSE,
} from "@welshman/util"
import {getPubkey} from "@welshman/signer"
import {bytesToHex, hexToBytes} from "@noble/hashes/utils"
import * as nip19 from "nostr-tools/nip19"
import * as nip05 from "nostr-tools/nip05"
import {parseJson} from "src/util/misc"

export const nsecEncode = (secret: string) => nip19.nsecEncode(hexToBytes(secret))

export const nsecDecode = (nsec: string) => {
  const {type, data} = nip19.decode(nsec)

  if (type !== "nsec") {
    // Use curly braces for multi-line if
    throw new Error(`Invalid nsec: ${nsec}`)
  }

  return bytesToHex(data)
}

export const isKeyValid = (key: string): boolean => {
  try {
    getPubkey(key)
    return true
  } catch (e) {
    return false
  }
}

export const noteKinds = [NOTE, PICTURE_NOTE, LONG_FORM, HIGHLIGHT]
export const reactionKinds = [REACTION, ZAP_RESPONSE] as number[]
export const repostKinds = [REPOST, GENERIC_REPOST] as number[]
export const metaKinds = [PROFILE, FOLLOWS, MUTES, RELAYS, INBOX_RELAYS] as number[]
export const headerlessKinds = [
  GROUPS,
  FEED,
  NAMED_PEOPLE,
  NAMED_RELAYS,
  NAMED_CURATIONS,
  NAMED_WIKI_AUTHORS,
  NAMED_WIKI_RELAYS,
  NAMED_EMOJIS,
  NAMED_TOPICS,
  NAMED_ARTIFACTS,
  NAMED_COMMUNITIES,
  MUTES,
  PINS,
  BOOKMARKS,
  COMMUNITIES,
  CHANNELS,
  TOPICS,
  GROUPS,
]

export const appDataKeys = {
  USER_SETTINGS: "nostr-engine/User/settings/v1",
}

export const isLike = (e: TrustedEvent) =>
  e.kind === REACTION &&
  ["", "+", "🤙", "👍", "❤️", "😎", "🏅", "🫂", "🤣", "😂", "💜", "🔥"].includes(e.content)

export const isReply = (e: TrustedEvent) =>
  Boolean([NOTE, COMMENT].includes(e.kind) && getParentIdOrAddr(e))

export const decodeNostrEntityToHex = (entity: string): string | null => {
  if (entity.match(/^[a-fA-F0-9]{64}$/)) {
    return entity
  }

  try {
    let key = nip19.decode(entity).data

    if (key instanceof Uint8Array) {
      // Use curly braces for multi-line if
      key = Buffer.from(key).toString("hex")
    }

    return key as string
  } catch (e) {
    return null
  }
}

export const getRating = (event: TrustedEvent) => {
  if (event.kind === 1985) {
    const reviewTag = getTags("l", event.tags).find(nthEq(1, "review/relay"))
    return parseJson(last(reviewTag || []))?.quality
  }

  const ratingTag = getTags("rating", event.tags).find(t => t.length === 2)
  return parseInt(ratingTag?.[1] || "", 10) || undefined // Explicit radix
}

export const getAvgRating = (events: TrustedEvent[]) =>
  avg(events.map(getRating).filter(rating => rating !== undefined))

export const isHex = (x: any): x is string =>
  typeof x === "string" && x.length === 64 && /^[a-f0-9]{64}$/.test(x)

export const getContentWarning = (e: TrustedEvent) => {
  return getTagValue("content-warning", e.tags)
}

export const parseAnything = async (entity: string) => {
  if (entity.includes("@")) {
    try {
      // Added try-catch for nip05.queryProfile
      const profile = await nip05.queryProfile(entity)
      if (profile) {
        return {type: "npub", pubkey: profile.pubkey}
      }
    } catch (error) {
      console.error("NIP-05 lookup failed:", error) // Log NIP-05 errors
    }
  }

  return parseAnythingSync(entity)
}

export const parseAnythingSync = (entity: string) => {
  const normalizedEntity = fromNostrURI(entity)

  if (Address.isAddress(normalizedEntity)) {
    // Use curly braces for multi-line if
    return nip19.decode(Address.from(normalizedEntity).toNaddr())
  }

  if (isHex(normalizedEntity)) {
    // Use curly braces for multi-line if
    return {type: "npub", pubkey: normalizedEntity}
  }

  try {
    return nip19.decode(normalizedEntity)
  } catch (e) {
    return null
  }
}

export const parsePubkey = async (entity: string) => {
  const result = await parseAnything(entity)
  return result?.type === "npub" || result?.type === "nprofile" ? result.data : undefined
}

export async function extractPrivateKey(input: string): Promise<string | null> {
  // Try decoding as NSEC
  try {
    return nsecDecode(input)
  } catch (e) {
    // Not a valid NSEC, try next
  }

  // Try as hex
  if (isHex(input)) {
    // Use curly braces for multi-line if
    return input
  }

  // Try as JSON
  try {
    const json = JSON.parse(input)
    const privateKey = json?.privateKey || json?.sec
    if (typeof privateKey === "string") {
      // Use curly braces for multi-line if
      return privateKey
    }
  } catch (e) {
    // Not a valid JSON, try next
  }

  return null // No valid key found
}
