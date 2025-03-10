// Example: Assuming a RelayService manages Relays instances
import { Relays } from 'lib/net/src/target/Relays';
import { Connection } from 'src/net';
class RelayService {
    relays;
    connections;
    constructor(relayUrls) {
        this.connections = relayUrls.map(url => new Connection(url));
        this.relays = new Relays(this.connections);
    }
    shutdown() {
        console.log("destroy() called on relays", this); // Add logging
        this.relays.destroy(); // Call destroy() when the service is shut down
        this.connections.forEach(connection => {
            connection.socket.close(); // Close each connection
        });
    }
}
//# sourceMappingURL=RelayService.js.map