import {fromPairs, randomId} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {
  BLOCKED_RELAYS,
  BOOKMARKS,
  CHANNELS,
  COMMUNITIES,
  FOLLOWS,
  getAddress,
  GROUPS,
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
  PINS,
  RELAYS,
  SEARCH_RELAYS,
  TOPICS,
} from "@welshman/util"
import {SearchHelper} from "src/util/misc"

export const CUSTOM_LIST_KINDS = [
  FOLLOWS,
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
  RELAYS,
  BOOKMARKS,
  COMMUNITIES,
  CHANNELS,
  BLOCKED_RELAYS,
  SEARCH_RELAYS,
  GROUPS,
  TOPICS,
] as const

export const EDITABLE_LIST_KINDS = [NAMED_PEOPLE, NAMED_RELAYS, NAMED_CURATIONS, NAMED_TOPICS] as const

export type UserList = {
  kind: number
  title: string
  description: string
  identifier: string
  tags: string[][]
  event?: TrustedEvent
}

export type PublishedUserList = Omit<UserList, "event"> & {
  event: TrustedEvent
}

export type PublishedListFeed = Omit<UserList, "list"> & {
  event: TrustedEvent
  list: PublishedUserList
}


export const makeUserList = (list: Partial<UserList> = {}): UserList => ({
  kind: NAMED_PEOPLE,
  title: "",
  description: "",
  identifier: randomId(),
  tags: [],
  ...list,
})

export const readUserList = (event: TrustedEvent) => {
  const {
    d: identifier = randomId(),
    name = "",
    title = "",
    description = "",
  } = fromPairs(event.tags)

  return {
    kind: event.kind,
    title: title || name,
    description,
    identifier,
    tags: event.tags,
    event,
  } as PublishedUserList
}

export const createUserListPayload = ({kind, title, description, identifier, tags}: UserList) => {
  const data = {title, alt: title, d: identifier, description}
  return {kind, tags: tags.filter(t => !data[t[0]]).concat(Object.entries(data))}
}


const userListDisplayNames = {
  [FOLLOWS]: "[follows list]",
  [NAMED_PEOPLE]: "[named people list]",
  [NAMED_RELAYS]: "[named relays list]",
  [NAMED_CURATIONS]: "[named curations list]",
  [NAMED_WIKI_AUTHORS]: "[named wiki authors list]",
  [NAMED_WIKI_RELAYS]: "[named wiki relays list]",
  [NAMED_EMOJIS]: "[named emojis list]",
  [NAMED_TOPICS]: "[named topics list]",
  [NAMED_ARTIFACTS]: "[named artifacts list]",
  [NAMED_COMMUNITIES]: "[named communities list]",
  [MUTES]: "[mutes list]",
  [PINS]: "[pins list]",
  [RELAYS]: "[relays list]",
  [BOOKMARKS]: "[bookmarks list]",
  [COMMUNITIES]: "[communities list]",
  [CHANNELS]: "[channels list]",
  [BLOCKED_RELAYS]: "[blocked relays list]",
  [SEARCH_RELAYS]: "[search relays list]",
  [GROUPS]: "[groups list]",
  [TOPICS]: "[topics list]",
}

export const displayUserList = (list?: UserList) => {
  if (list?.title) {
    return list.title
  }
  return userListDisplayNames[list?.kind] || "[no name]"
}


export class UserListSearch extends SearchHelper<UserList, string> {
  config = {keys: ["title", "description", "identifier"]}
  getValue = (option: UserList) => getAddress(option.event)
  displayValue = (address: string) => displayUserList(this.getOption(address))
}
