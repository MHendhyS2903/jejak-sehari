const NS = 'jejak-sehari:'
const memory = new Map()
let available = null

export function storageAvailable() {
  if (available !== null) return available
  try {
    const k = NS + '__probe'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    available = true
  } catch {
    available = false
  }
  return available
}

export function load(key) {
  try {
    if (storageAvailable()) {
      const raw = window.localStorage.getItem(NS + key)
      return raw ? JSON.parse(raw) : null
    }
  } catch {
  }
  return memory.has(key) ? memory.get(key) : null
}

export function save(key, value) {
  memory.set(key, value)
  try {
    if (storageAvailable()) window.localStorage.setItem(NS + key, JSON.stringify(value))
  } catch {
    available = false
  }
}

export function remove(key) {
  memory.delete(key)
  try {
    if (storageAvailable()) window.localStorage.removeItem(NS + key)
  } catch {
  }
}
