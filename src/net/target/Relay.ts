import {Emitter} from "src/lib"
import {ConnectionEvent} from "src/net/ConnectionEvent.js"
import type {Message} from "src/net/Socket"
import type {Connection} from "src/net/Connection.js"

export class Relay extends Emitter {
  constructor(readonly connection: Connection) {
    super()

    this.connection.on(ConnectionEvent.Receive, this.onMessage)
  }

  get connections() {
    return [this.connection]
  }

  async send(...payload: Message) {
    await this.connection.send(payload)
  }

  onMessage = (connection: Connection, [verb, ...payload]: Message) => {
    this.emit(verb, connection.url, ...payload)
  }

  cleanup = () => {
    this.removeAllListeners()
    this.connection.off(ConnectionEvent.Receive, this.onMessage)
  }
}
