import { trafficFactor } from './time.js'
import { load, save } from './storage.js'

const CACHE_KEY = 'routes'
const mem = new Map()

const r3 = (n) => (+n).toFixed(3)
export const pairKey = (a, b) => `${r3(a.lat)},${r3(a.lng)}>${r3(b.lat)},${r3(b.lng)}`

export function haversineKm(a, b) {
  const R = 6371
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function offlineEntry(a, b) {
  const km = haversineKm(a, b) * 1.4
  return { km, min: (km / 25) * 60, source: 'offline' }
}

export function cachedEntry(a, b) {
  const k = pairKey(a, b)
  if (mem.has(k)) return mem.get(k)
  const c = load(CACHE_KEY)
  if (c && c[k]) {
    mem.set(k, c[k])
    return c[k]
  }
  return null
}

export async function fetchRoute(a, b) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error('osrm')
    const json = await res.json()
    const route = json.routes?.[0]
    if (!route) throw new Error('osrm')
    const entry = { km: route.distance / 1000, min: route.duration / 60, source: 'osrm' }
    const k = pairKey(a, b)
    mem.set(k, entry)
    save(CACHE_KEY, { ...(load(CACHE_KEY) || {}), [k]: entry })
    return entry
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function makeTravel(entry, manualMinutes) {
  return (departMin) => {
    if (manualMinutes > 0) return { minutes: manualMinutes, factor: 1, label: 'manual' }
    const factor = trafficFactor(departMin)
    return {
      minutes: Math.max(5, entry.min * factor),
      factor,
      label: entry.source === 'osrm' ? 'estimasi' : 'estimasi offline',
    }
  }
}
