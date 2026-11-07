export const NORMAL = 0.5

class Playback {
  constructor() {
    this.progress = 0
    this.playing = false
    this.speed = NORMAL
    this.listeners = new Set()
    this.snapshot = { progress: 0, playing: false, speed: NORMAL, real: false, realMinute: 0 }
    this.realMin = 0
    this.minFn = null
    this.real = null
    this.lastEmit = 0
    this.seekVersion = 0
  }

  subscribe = (fn) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = () => this.snapshot

  emit(force = true) {
    const now = performance.now()
    if (!force && now - this.lastEmit < 90) return
    this.lastEmit = now
    this.snapshot = { progress: this.progress, playing: this.playing, speed: this.speed, real: !!this.real, realMinute: this.realMin }
    this.listeners.forEach((l) => l())
  }

  setReal(fn, minFn) {
    this.real = fn || null
    this.minFn = minFn || null
    if (fn) {
      this.speed = 1
      this.playing = true
      this.realMin = minFn ? minFn() : 0
      this.progress = fn()
      this.seekVersion++
    }
    this.emit()
  }

  play() {
    this.real = null
    if (this.progress >= 1) {
      this.progress = 0
      this.seekVersion++
    }
    this.playing = true
    this.emit()
  }

  pause() {
    this.real = null
    this.playing = false
    this.emit()
  }

  toggle() {
    this.playing ? this.pause() : this.play()
  }

  setSpeed(s) {
    this.real = null
    this.speed = s
    this.emit()
  }

  seek(p) {
    if (this.real) {
      this.real = null
      this.playing = false
    }
    this.seekVersion++
    this.progress = Math.min(1, Math.max(0, p))
    this.emit()
  }

  tick(dt, totalSec) {
    if (this.real) {
      this.progress = Math.min(1, Math.max(0, this.real()))
      if (this.minFn) this.realMin = this.minFn()
      this.emit(false)
      return
    }
    if (!this.playing) return
    this.progress += (dt * this.speed) / totalSec
    if (this.progress >= 1) {
      this.progress = 1
      this.playing = false
      this.emit()
      return
    }
    this.emit(false)
  }
}

export const playback = new Playback()
