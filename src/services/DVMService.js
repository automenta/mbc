// Example: Assuming a DVMService manages DVM instances
import { DVM } from 'lib/dvm/src/handler';
class DVMService {
    dvm;
    constructor(opts) {
        this.dvm = new DVM(opts);
    }
    start() {
        this.dvm.start();
    }
    stop() {
        this.dvm.stop(); // This already calls destroy(), but double-check
    }
    destroy() {
        console.log("destroy() called on DVMService", this);
        this.dvm.stop(); // Ensure DVM is stopped
    }
}
//# sourceMappingURL=DVMService.js.map