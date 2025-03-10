import {Emitter} from "src/lib"
import type {Message} from "src/net"


export class Echo extends Emitter {
  get connections() {
    return []
  }

  async send(...payload: Message) {
    this.emit(...payload)
  }

  cleanup = () => {
    this.removeAllListeners()
  }
}
