import {Emitter} from "src/lib"
import {LOCAL_RELAY_URL, Relay} from "src/util"
import type {Message} from "src/net/Socket"

export class Local extends Emitter {
  constructor(readonly relay: Relay) {
    super()

    relay.on("*", this.onMessage)
  }

  get connections() {
    return []
  }

  async send(...payload: Message) {
    await this.relay.send(...payload)
  }

  onMessage = (...message: Message) => {
    const [verb, ...payload] = message

    this.emit(verb, LOCAL_RELAY_URL, ...payload)
  }

  cleanup = () => {
    this.removeAllListeners()
    this.relay.off("*", this.onMessage)
  }
}
