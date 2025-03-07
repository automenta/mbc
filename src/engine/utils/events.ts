import {sortBy} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"

export const sortEventsDesc = (events: TrustedEvent[]) => sortBy(event => -event.created_at, events)
