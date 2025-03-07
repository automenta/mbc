import EventEmitter from "events"
import Hls from "hls.js"
import logger from "src/util/logger" // Import logger

export class AudioController extends EventEmitter {
  completed = false
  progress = 0
  interval: number | null = null // Explicit type
  audio = new Audio()
  hls?: Hls

  constructor(readonly url: string) {
    super()

    if (url.endsWith("m3u8")) {
      if (Hls.isSupported()) {
        this.hls = new Hls()
        this.hls.loadSource(this.url)
        this.hls.attachMedia(this.audio)
        this.hls.on(Hls.Events.ERROR, (event, data) => { // Added error handling for HLS
          logger.warn("HLS error:", event, data)
          this.emit("error", data) // Emit error event for component to handle
        });
      } else {
        logger.warn("HLS is not supported in this browser, falling back to native audio.")
        this.audio.src = url; // Fallback to native if HLS not supported
      }
    } else {
      this.audio.src = url
    }

    this.audio.addEventListener('error', (event) => { // Added general audio error listener
      logger.warn("Audio element error:", event, this.audio.error);
      this.emit("error", this.audio.error); // Emit error event
    });
  }


  reportProgress = () => {
    if (this.audio.duration) { // Check if duration is available to avoid NaN
      this.progress = this.audio.currentTime / this.audio.duration
    } else {
      this.progress = 0; // Default to 0 if duration is not available
    }


    this.emit("progress", this.progress)

    if (this.progress >= 0.999 && !this.completed) { // Using >= 0.999 for more reliable completion
      this.completed = true
      this.emit("completed")
    }
  }

  setProgress = (progress: number) => {
    if (this.audio.duration) { // Check duration before setting currentTime
      this.audio.currentTime = this.audio.duration * progress
      this.reportProgress()
    }
  }

  play = () => {
    if (!this.interval) {
      void this.audio.play().catch(e => { // Catch play promise rejection
        logger.warn("Audio play failed:", e)
        this.emit("error", e) // Emit error event if play fails
      })
      this.emit("play")
      this.interval = setInterval(this.reportProgress, 30) as unknown as number // Type assertion for setInterval
    }
  }

  pause = () => {
    if (this.interval) {
      this.audio.pause()
      this.emit("pause")

      clearInterval(this.interval)
      this.interval = null
    }
  }

  toggle = () => {
    if (this.interval) {
      this.pause()
    } else {
      this.play()
    }
  }

  cleanup() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    if (this.hls) {
      this.hls.destroy()
      this.hls = undefined // Help garbage collection
    }
    this.audio.pause()
  }
}
