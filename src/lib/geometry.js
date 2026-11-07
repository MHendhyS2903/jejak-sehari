import { load, save } from './storage.js'
import { haversineKm, pairKey } from './estimate.js'

const KEY = 'geo'
const mem = new Map()

const round = (n) => Math.round(n * 1e5) / 1e5

function thin(pts, max = 400) {
  if (pts.length <= max) return pts
  const step = (pts.length - 1) / (max - 1)
  const out = []
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)])
  return out
}

export function cachedGeometry(a, b) {
  const k = pairKey(a, b)
  if (mem.has(k)) return mem.get(k)
  const c = load(KEY)
  if (c && c[k]) {
    mem.set(k, c[k])
    return c[k]
  }
  return null
}

export async function fetchGeometry(a, b) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error('osrm')
    const json = await res.json()
    const coords = json.routes?.[0]?.geometry?.coordinates
    if (!coords?.length) throw new Error('osrm')
    const pts = thin(coords.map(([lng, lat]) => [round(lat), round(lng)]))
    const k = pairKey(a, b)
    mem.set(k, pts)
    try {
      const all = load(KEY) || {}
      const keys = Object.keys(all)
      if (keys.length > 6) delete all[keys[0]]
      save(KEY, { ...all, [k]: pts })
    } catch {
    }
    return pts
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function makeTrack(points) {
  const pts = points.length > 1 ? points : [points[0], points[0]]
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + haversineKm({ lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: pts[i][0], lng: pts[i][1] }))
  }
  const total = cum[cum.length - 1] || 1e-9
  const at = (u) => {
    const d = Math.min(1, Math.max(0, u)) * total
    let i = 1
    while (i < cum.length - 1 && cum[i] < d) i++
    const seg = cum[i] - cum[i - 1] || 1e-9
    const f = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg))
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const lat = p0[0] + (p1[0] - p0[0]) * f
    const lng = p0[1] + (p1[1] - p0[1]) * f
    const dy = p1[0] - p0[0]
    const dx = (p1[1] - p0[1]) * Math.cos((lat * Math.PI) / 180)
    return { lat, lng, heading: (Math.atan2(dx, dy) * 180) / Math.PI, i }
  }
  const upTo = (u) => {
    const p = at(u)
    return [...pts.slice(0, p.i), [p.lat, p.lng]]
  }
  return { pts, total, at, upTo, reversed: () => makeTrack([...pts].reverse()) }
}
