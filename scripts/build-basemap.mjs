import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
if (!dir) throw new Error('Sertakan folder data')
const read = (n) => {
  const f = path.join(dir, n)
  if (!fs.existsSync(f)) return []
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8')).elements || []
  } catch {
    console.warn('lewati (bukan JSON valid):', n)
    return []
  }
}

const LAT0 = -6.4
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const KY = 110574

function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const P = pts.map((p) => [p.lon * KX, p.lat * KY])
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let max = 0
    let idx = -1
    const [ax, ay] = P[a]
    const [bx, by] = P[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1e-9
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / len
      if (d > max) { max = d; idx = i }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

function simplifyRing(pts, tol) {
  const m = Math.floor(pts.length / 2)
  const a = simplify(pts.slice(0, m + 1), tol)
  const b = simplify(pts.slice(m), tol)
  return a.concat(b.slice(1))
}

function encNum(n, out) {
  let v = n < 0 ? ~(n << 1) : n << 1
  while (v >= 0x20) { out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63)); v >>= 5 }
  out.push(String.fromCharCode(v + 63))
}
function encode(pts) {
  const out = []
  let pl = 0, pg = 0
  for (const p of pts) {
    const la = Math.round(p.lat * 1e5)
    const lo = Math.round(p.lon * 1e5)
    encNum(la - pl, out)
    encNum(lo - pg, out)
    pl = la
    pg = lo
  }
  return out.join('')
}

const CLS = { motorway: 0, trunk: 0, primary: 1, secondary: 2, tertiary: 3 }
const lines = []
const labels = new Map()
let nPts = 0
for (const file of ['roads1.json', 'tert.json']) {
  for (const w of read(file)) {
    const hw = w.tags?.highway
    if (!(hw in CLS) || !w.geometry || w.geometry.length < 2) continue
    const c = CLS[hw]
    const pts = simplify(w.geometry, c === 3 ? 7 : 5)
    if (pts.length < 2) continue
    nPts += pts.length
    lines.push([c, encode(pts)])
    const nm = w.tags.name
    if (nm && c <= 2) {
      const len = w.geometry.length
      const cur = labels.get(nm)
      if (!cur || len > cur.len) {
        const m = w.geometry[Math.floor(len / 2)]
        labels.set(nm, { len, lat: +m.lat.toFixed(4), lng: +m.lon.toFixed(4), c })
      }
    }
  }
}

const water = read('water.json')
const rivers = []
const coast = []
for (const w of water) {
  if (!w.geometry) continue
  if (w.tags?.natural === 'coastline') coast.push(w.geometry.map((p) => [p.lat, p.lon]))
  else if (w.tags?.waterway) rivers.push([w.tags.waterway === 'river' ? 0 : 1, encode(simplify(w.geometry, 6))])
}
const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`
const chains = coast.map((c) => c.slice())
let merged = true
while (merged) {
  merged = false
  outer: for (let i = 0; i < chains.length; i++) {
    for (let j = 0; j < chains.length; j++) {
      if (i === j) continue
      const a = chains[i]
      const b = chains[j]
      if (key(a[a.length - 1]) === key(b[0])) {
        chains[i] = a.concat(b.slice(1))
        chains.splice(j, 1)
        merged = true
        break outer
      }
    }
  }
}
const TOP = -6.0
const sea = []
const islands = []
for (const ch of chains) {
  const closed = key(ch[0]) === key(ch[ch.length - 1])
  const raw = ch.map(([lat, lon]) => ({ lat, lon }))
  if (closed) { islands.push(encode(simplifyRing(raw, 12))); continue }
  const pts = simplify(raw, 15)
  let seq = pts
  if (seq[0].lon > seq[seq.length - 1].lon) seq = seq.slice().reverse()
  if (seq.length < 20 && Math.abs(seq[0].lon - seq[seq.length - 1].lon) < 0.05) continue
  seq = seq.concat([{ lat: TOP, lon: seq[seq.length - 1].lon }, { lat: TOP, lon: seq[0].lon }])
  sea.push(encode(seq))
}

const areas = []
for (const w of read('parks.json')) {
  if (!w.geometry || w.geometry.length < 4) continue
  const kind = w.tags?.natural === 'water' ? 1 : 0
  const pts = simplifyRing(w.geometry, 8)
  if (pts.length < 4) continue
  areas.push([kind, encode(pts)])
}
const places = []
const RANK = { city: 0, town: 1, suburb: 2 }
for (const n of read('places.json')) {
  if (n.tags?.name && n.tags.place in RANK) places.push([n.tags.name, +n.lat.toFixed(4), +n.lon.toFixed(4), RANK[n.tags.place]])
}

const out = {
  roads: lines,
  rivers,
  sea,
  islands,
  areas,
  places,
  names: [...labels].map(([n, v]) => [n, v.lat, v.lng, v.c]),
}
const dest = path.resolve('src/data/basemap.json')
fs.writeFileSync(dest, JSON.stringify(out))
console.log('roads', lines.length, 'pts', nPts, 'rivers', rivers.length, 'sea', sea.length, 'islands', islands.length, 'areas', areas.length, 'places', places.length, 'names', labels.size)
console.log('bytes', fs.statSync(dest).size)
