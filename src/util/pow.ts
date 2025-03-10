import type {HashedEvent, OwnedEvent} from "./"
import {createEvent} from "./"
import {getPubkey, makeSecret, own} from "src/signer"
import {synced, withGetter} from "src/store"
import PowWorker from "src/workers/pow?worker"
import {isMobile} from "src/util/html"

export const benchmark = withGetter(synced("benchmark", 0))

export const defaultBenchmarkDifficulty = isMobile ? 14 : 16

export const estimateWork = (difficulty: number) =>
  Math.ceil(benchmark.get() * Math.pow(2, difficulty - defaultBenchmarkDifficulty))

export type ProofOfWork = {
  worker: Worker
  result: Promise<HashedEvent>
}

export const makePow = (event: OwnedEvent, difficulty: number): ProofOfWork => {
  const worker = new PowWorker()

  const result = new Promise<HashedEvent>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<HashedEvent>) => {
      resolve(e.data)
      worker.terminate()
    }

    worker.onerror = e => {
      // Corrected type for error event
      reject(e)
      worker.terminate()
    }

    worker.postMessage({difficulty, event})
  })

  return {worker, result}
}

// Generate a simple pow to estimate device capacities
if (benchmark.get() === 0) {
  const secret = makeSecret()
  const pubkey = getPubkey(secret)
  const event = own(createEvent(1, {}), pubkey)
  const pow = makePow(event, defaultBenchmarkDifficulty)
  const start = Date.now()

  pow.result
    .then(() => {
      benchmark.set(Date.now() - start)
    })
    .catch(e => {
      // Added catch to prevent unhandled promise rejection
      console.error("Benchmark POW failed", e)
    })
}
