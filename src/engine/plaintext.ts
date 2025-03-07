import {
  getSession,
  getSigner,
  plaintext,
  repository,
  setPlaintext,
  tracker,
} from "@welshman/app"
import {Worker} from "@welshman/lib"
import {Nip59} from "@welshman/signer"
import type {SignedEvent, TrustedEvent} from "@welshman/util"
import {
  APP_DATA,
  FOLLOWS,
  getPlaintext,
  getTagValue,
  isHashedEvent,
  MUTES,
  WRAP,
} from "@welshman/util"

import logger from "src/util/logger"
import {canDecrypt} from "./state"

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

  let unwrappedEvent = repository.eventsByWrap.get(event.id)
  if (unwrappedEvent) {
    return unwrappedEvent
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
      unwrappedEvent = await unwrapPromise
    } catch (error) {
      logger.error("Failed to unwrap event", error)
    }
  }

  if (unwrappedEvent && isHashedEvent(unwrappedEvent)) {
    pendingUnwraps.delete(event.id)
    tracker.copy(event.id, unwrappedEvent.id)
    // eslint-disable-next-line no-undef
    // relay.send("EVENT", unwrappedEvent) // relay is undefined here
  }

  return unwrappedEvent
}

// Unwrap/decrypt stuff as it comes in

const unwrapper = new Worker<TrustedEvent>({chunkSize: 10})

unwrapper.addGlobalHandler(async (event: TrustedEvent) => {
  if (event.kind === WRAP) {
    await ensureUnwrapped(event)
  } else {
    await ensureMessagePlaintext(event)
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
