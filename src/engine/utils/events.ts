import {sortBy} from "src/lib"
import type {TrustedEvent} from "src/util"

export const sortEventsDesc = (events: TrustedEvent[]) => sortBy(event => -event.created_at, events)
