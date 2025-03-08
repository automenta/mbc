import {derived} from "svelte/store"
import {pubkey} from "./session.js"
import {loadProfile, profilesByPubkey} from "./profiles.js"
import {followsByPubkey, loadFollows} from "./follows.js"
import {loadPins, pinsByPubkey} from "./pins.js"
import {loadMutes, mutesByPubkey} from "./mutes.js"
import {
  inboxRelaySelectionsByPubkey,
  loadInboxRelaySelections,
  loadRelaySelections,
  relaySelectionsByPubkey,
} from "./relaySelections.js"
import {wotGraph} from "./wot.js"

export const userProfile = derived([profilesByPubkey, pubkey], ([$profilesByPubkey, $pubkey]) => {
  if (!$pubkey) return undefined

  loadProfile($pubkey)

  return $profilesByPubkey.get($pubkey)
})

export const userFollows = derived([followsByPubkey, pubkey], ([$followsByPubkey, $pubkey]) => {
  if (!$pubkey) return undefined

  loadFollows($pubkey)

  return $followsByPubkey.get($pubkey)
})

export const userMutes = derived([mutesByPubkey, pubkey], ([$mutesByPubkey, $pubkey]) => {
  if (!$pubkey) return undefined

  loadMutes($pubkey)

  return $mutesByPubkey.get($pubkey)
})

export const userPins = derived([pinsByPubkey, pubkey], ([$pinsByPubkey, $pubkey]) => {
  if (!$pubkey) return undefined

  loadPins($pubkey)
  return $pinsByPubkey.get($pubkey)
})

export const userRelaySelections = derived(
  [relaySelectionsByPubkey, pubkey],
  ([$relaySelectionsByPubkey, $pubkey]) => {
    if (!$pubkey) return undefined

    loadRelaySelections($pubkey)

    return $relaySelectionsByPubkey.get($pubkey)
  },
)

export const userInboxRelaySelections = derived(
  [inboxRelaySelectionsByPubkey, pubkey],
  ([$inboxRelaySelectionsByPubkey, $pubkey]) => {
    if (!$pubkey) return undefined

    loadInboxRelaySelections($pubkey)

    return $inboxRelaySelectionsByPubkey.get($pubkey)
  },
)

export const getUserWotScore = (tpk: string) => wotGraph.get().get(tpk) || 0

export const deriveUserWotScore = (tpk: string) => derived(wotGraph, $g => $g.get(tpk) || 0)
