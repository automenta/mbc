import {
  asDecryptedEvent,
  MUTES,
  type PublishedList,
  readList,
  type TrustedEvent,
} from "src/util"
import {type SubscribeRequestWithHandlers} from "src/net"
import {deriveEventsMapped} from "src/store"
import {repository} from "./core.js"
import {load} from "./subscribe.js"
import {collection} from "./collection.js"
import {ensurePlaintext} from "./plaintext.js"
import {loadRelaySelections} from "./relaySelections.js"

export const mutes = deriveEventsMapped<PublishedList>(repository, {
  filters: [{kinds: [MUTES]}],
  itemToEvent: item => item.event,
  eventToItem: async (event: TrustedEvent) =>
    readList(
      asDecryptedEvent(event, {
        content: await ensurePlaintext(event),
      }),
    ),
})

export const {
  indexStore: mutesByPubkey,
  deriveItem: deriveMutes,
  loadItem: loadMutes,
} = collection({
  name: "mutes",
  store: mutes,
  getKey: mute => mute.event.pubkey,
  load: async (pubkey: string, request: Partial<SubscribeRequestWithHandlers> = {}) => {
    await loadRelaySelections(pubkey, request)
    await load({...request, filters: [{kinds: [MUTES], authors: [pubkey]}]})
  },
})
