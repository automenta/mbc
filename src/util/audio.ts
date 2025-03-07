import EventEmitter from "events"
import Hls from "hls.js"

export class AudioController extends EventEmitter {
  completed = false
  progress = 0
  interval: number | null = null
  audio = new Audio()
  hls?: Hls

  constructor(readonly url: string) {
    super()

    if (url.endsWith("m3u8")) {
      this.hls = new Hls()
      this.hls.loadSource(this.url)
      this.hls.attachMedia(this.audio)
    } else {
      this.audio.src = url
    }
  }

  reportProgress = () => {
    const {currentTime, duration} = this.audio

    this.progress = currentTime ? currentTime / duration : 0

    this.emit("progress", this.progress)

    if (this.progress === 1 && !this.completed) {
      this.completed = true
      this.emit("completed")
    }
  }

  setProgress = (progress: number) => {
    this.audio.currentTime = Math.round(this.audio.duration * progress)
    this.reportProgress()
  }

  play = () => {
    if (!this.interval) {
      this.audio.play()
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
    this.hls?.destroy()
    this.audio.pause()
  }
}
