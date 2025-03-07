import {derived} from "svelte/store"

import {pubkey, repository} from "@welshman/app"
import {now, without} from "@welshman/lib"
import {deriveEvents} from "@welshman/store"
import type {TrustedEvent} from "@welshman/util"

import {OnboardingTask} from "src/engine/model"
import {sortEventsDesc} from "src/engine/utils"
import {checked, getSeenAt, isEventMuted, sessionWithMeta} from "src/engine/state"
import {noteKinds, reactionKinds} from "src/util/nostr"

export const isSeen = derived(
  getSeenAt,
  $getSeenAt => (key: string, event: TrustedEvent) => $getSeenAt(key, event) > 0,
)

export const setChecked = (path: string, timestamp = now()) =>
  checked.update(state => ({...state, [path]: timestamp}))

// Main Notifications
const notificationFilter = (pubkey) => ({
  kinds: noteKinds,
  "#p": [pubkey],
})

export const mainNotifications = derived(
  [pubkey, isEventMuted, deriveEvents(repository, {throttle: 800, filters: [notificationFilter(get(pubkey))]})],
  ([$pubkey, $isEventMuted, $events]) =>
    sortEventsDesc(
      $events.filter(
        e =>
          e.pubkey !== $pubkey &&
          e.tags.some(t => t[0] === "p" && t[1] === $pubkey) &&
          !$isEventMuted(e),
      ),
    ),
)

export const unreadMainNotifications = derived([isSeen, mainNotifications], ([$isSeen, events]) =>
  events.filter(e => !$isSeen("notes/*", e)),
)

export const hasNewNotifications = derived(
  [sessionWithMeta, unreadMainNotifications],
  ([$sessionWithMeta, $unread]) => {
    if ($unread.length > 0) {
      return true
    }

    if ($sessionWithMeta?.onboarding_tasks_completed) {
      const uncompletedTasks = without(
        $sessionWithMeta.onboarding_tasks_completed,
        Object.values(OnboardingTask),
      )
      return uncompletedTasks.length > 0
    }

    return false
  },
)

// Reaction Notifications
const reactionNotificationFilter = (pubkey) => ({
  kinds: reactionKinds,
  "#p": [pubkey],
})

export const reactionNotifications = derived(
  [
    pubkey,
    isEventMuted,
    deriveEvents(repository, {throttle: 800, filters: [reactionNotificationFilter(get(pubkey))]}),
  ],
  ([$pubkey, $isEventMuted, $events]) =>
    sortEventsDesc(
      $events.filter(
        e =>
          e.pubkey !== $pubkey &&
          e.tags.some(t => t[0] === "p" && t[1] === $pubkey) &&
          !$isEventMuted(e),
      ),
    ),
)

export const unreadReactionNotifications = derived(
  [isSeen, reactionNotifications],
  ([$isSeen, events]) => events.filter(e => !$isSeen("reactions/*", e)),
)
