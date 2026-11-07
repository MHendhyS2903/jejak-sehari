import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const cache = new Map()
const listeners = new Set()
let total = 0
let done = 0

function toBuffer(uri) {
  const bin = atob(uri.slice(uri.indexOf(',') + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function start(url) {
  let e = cache.get(url)
  if (e) return e
  e = {}
  total++
  e.promise = Promise.resolve()
    .then(() => loader.parseAsync(toBuffer(url), ''))
    .then((v) => { e.value = v })
    .catch((err) => { e.error = err })
    .finally(() => {
      done++
      listeners.forEach((l) => l())
    })
  cache.set(url, e)
  return e
}

export const preloadGLB = (url) => { start(url) }

export function readGLB(url) {
  const e = start(url)
  if (e.error) throw e.error
  if (!e.value) throw e.promise
  return e.value
}

export const glbProgress = {
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
  get: () => (total ? Math.round((done / total) * 100) : 0),
}
