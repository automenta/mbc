import type {Session} from "src/app"
import type {TrustedEvent} from "src/util"

// export type Zapper = WelshmanZapper & {
//   lnurl: string
//   pubkey: string
// }
//
// export type PublishInfo = Omit<Publish, "emitter" | "result">
//
// export type Notification = {
//   key: string
//   type: string
//   root: string
//   timestamp: number
//   interactions: TrustedEvent[]
// }

export enum OnboardingTask {
  BackupKey = "backup_key",
  SetupWallet = "setup_wallet",
}

// export type Topic = {
//   count?: number
//   last_seen?: number
//   name: string
// }

export type Channel = {
  id: string
  last_checked?: number
  last_received?: number
  last_sent?: number
  messages: TrustedEvent[]
}

export type SessionWithMeta = Session & {
  onboarding_tasks_completed?: string[]
}

export type AnonymousUserState = {
  follows: string[][]
  relays: string[][]
}
