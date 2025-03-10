import {describe, expect, it} from "vitest"
import type {TrustedEvent} from "src/util"
import {sortEventsDesc} from "../../src/engine/utils"
import {getTestTrustedEvent} from "src/util/fake"

describe("engine events util", () => {
  describe("sortEventsDesc", () => {
    it("should return events in descending order (created_at timestamp)", () => {
      const events: TrustedEvent[] = [
        getTestTrustedEvent({created_at: 100}),
        getTestTrustedEvent({content: "I love Bitcoin!", created_at: 200}),
      ]

      const sortedEvents = sortEventsDesc(events)

      expect(sortedEvents[0].content).toEqual("I love Bitcoin!")
      expect(sortedEvents[0].created_at).toEqual(200)
    })
  })
})
