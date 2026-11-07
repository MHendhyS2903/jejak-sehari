import L from 'leaflet'
import data from '../../data/basemap.json'

export const COVER = { s: -6.72, w: 106.52, n: -6.04, e: 107.12 }
export const inCover = (p) => p.lat >= COVER.s && p.lat <= COVER.n && p.lng >= COVER.w && p.lng <= COVER.e

const H = 20037508.342789244
const R = 6378137
const mx = (lon) => (lon * Math.PI * R) / 180
const my = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R

function decode(str) {
  const out = []
  let i = 0, la = 0, lo = 0
  while (i < str.length) {
    let r = 0, sh = 0, b
    do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5 } while (b >= 32)
    la += r & 1 ? ~(r >> 1) : r >> 1
    r = 0; sh = 0
    do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5 } while (b >= 32)
    lo += r & 1 ? ~(r >> 1) : r >> 1
    out.push(mx(lo / 1e5), my(la / 1e5))
  }
  return out
}

function feature(str, extra) {
  const p = decode(str)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < p.length; i += 2) {
    if (p[i] < x0) x0 = p[i]
    if (p[i] > x1) x1 = p[i]
    if (p[i + 1] < y0) y0 = p[i + 1]
    if (p[i + 1] > y1) y1 = p[i + 1]
  }
  return { p, x0, y0, x1, y1, ...extra }
}

let store = null
function prep() {
  if (store) return store
  store = {
    roads: [[], [], [], []],
    rivers: data.rivers.map(([k, s]) => feature(s, { k })),
    sea: data.sea.map((s) => feature(s)),
    islands: data.islands.map((s) => feature(s)),
    areas: data.areas.map(([k, s]) => feature(s, { k })),
  }
  data.roads.forEach(([c, s]) => store.roads[c].push(feature(s)))
  return store
}

const ROAD_MIN = [8, 10, 11.5, 13]
const ROAD_W = [3.4, 2.8, 2.2, 1.5]
const COL = {
  land: '#eef1f7', sea: '#a9cdee', water: '#bcd7f2', park: '#d3e8d1', island: '#eef1f7',
  roadFill: ['#ffcf7a', '#ffe3a1', '#ffffff', '#ffffff'],
  roadCase: ['#d89b3a', '#d9b36a', '#b9c2da', '#c8cfe3'],
}

function drawTile(canvas, coords, size) {
  const dpr = canvas.width / size.x
  const g = canvas.getContext('2d')
  g.scale(dpr, dpr)
  const z = coords.z
  const k = (256 * 2 ** z) / (2 * H)
  const ox = coords.x * 256
  const oy = coords.y * 256
  const pad = 14 / k
  const xmin = ox / k - H - pad, xmax = (ox + 256) / k - H + pad
  const ymax = H - oy / k + pad, ymin = H - (oy + 256) / k - pad
  const S = prep()
  const hit = (f) => f.x1 >= xmin && f.x0 <= xmax && f.y1 >= ymin && f.y0 <= ymax
  const path = (f, close) => {
    const p = f.p
    g.moveTo((p[0] + H) * k - ox, (H - p[1]) * k - oy)
    for (let i = 2; i < p.length; i += 2) g.lineTo((p[i] + H) * k - ox, (H - p[i + 1]) * k - oy)
    if (close) g.closePath()
  }
  const fill = (list, color) => {
    g.fillStyle = color
    for (const f of list) if (hit(f)) { g.beginPath(); path(f, true); g.fill() }
  }
  g.fillStyle = COL.land
  g.fillRect(0, 0, 256, 256)
  fill(S.sea, COL.sea)
  fill(S.islands, COL.island)
  if (z >= 11) {
    g.fillStyle = COL.water
    for (const f of S.areas) if (f.k === 1 && hit(f) && (f.x1 - f.x0) * k > 3) { g.beginPath(); path(f, true); g.fill() }
  }
  if (z >= 12) {
    g.fillStyle = COL.park
    for (const f of S.areas) if (f.k === 0 && hit(f) && (f.x1 - f.x0) * k > 4) { g.beginPath(); path(f, true); g.fill() }
  }
  g.lineCap = 'round'
  g.lineJoin = 'round'
  if (z >= 10) {
    g.strokeStyle = COL.water
    for (const f of S.rivers) {
      if (f.k === 1 && z < 13) continue
      if (!hit(f)) continue
      g.lineWidth = (f.k === 0 ? 3 : 1.6) * Math.max(0.6, (z - 9) * 0.3)
      g.beginPath(); path(f); g.stroke()
    }
  }
  const sc = Math.min(2.6, Math.max(0.55, 0.5 + (z - 10) * 0.24))
  for (const pass of [0, 1]) {
    for (let c = 3; c >= 0; c--) {
      if (z < ROAD_MIN[c]) continue
      g.strokeStyle = pass === 0 ? COL.roadCase[c] : COL.roadFill[c]
      g.lineWidth = ROAD_W[c] * sc + (pass === 0 ? 1.6 : 0)
      g.beginPath()
      let any = false
      for (const f of S.roads[c]) if (hit(f)) { path(f); any = true }
      if (any) g.stroke()
    }
  }
}

export const BaseLayer = L.GridLayer.extend({
  options: { tileSize: 256, updateWhenZooming: false, keepBuffer: 1 },
  createTile(coords) {
    const t = document.createElement('canvas')
    const size = this.getTileSize()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    t.width = size.x * dpr
    t.height = size.y * dpr
    t.style.width = `${size.x}px`
    t.style.height = `${size.y}px`
    drawTile(t, coords, size)
    return t
  },
})

const PLACE_Z = [8, 10, 12.5]
const el = (cls, txt) => {
  const e = document.createElement('div')
  e.className = cls
  e.textContent = txt
  return e
}

export function attachLabels(map) {
  map.createPane('labels').style.zIndex = 350
  const group = L.layerGroup().addTo(map)
  const cand = [
    ...data.places.map(([n, lat, lng, r]) => ({ n, lat, lng, cls: `mplace r${r}`, z: PLACE_Z[r], pri: r })),
    ...data.names.map(([n, lat, lng, c]) => ({ n, lat, lng, cls: 'mroad', z: c <= 1 ? 14.5 : 15.5, pri: 3 + c })),
  ].sort((a, b) => a.pri - b.pri)
  const update = () => {
    group.clearLayers()
    const z = map.getZoom()
    const b = map.getBounds().pad(0.1)
    const size = map.getSize()
    const placed = []
    let n = 0
    for (const c of cand) {
      if (z < c.z || !b.contains([c.lat, c.lng])) continue
      const p = map.latLngToContainerPoint([c.lat, c.lng])
      if (p.x < 0 || p.y < 0 || p.x > size.x || p.y > size.y) continue
      const w = c.n.length * (c.cls === 'mroad' ? 5.6 : 6.8) + 8
      const h = 16
      const r = { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - h / 2, y1: p.y + h / 2 }
      if (placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) continue
      placed.push(r)
      L.marker([c.lat, c.lng], {
        pane: 'labels', interactive: false, keyboard: false,
        icon: L.divIcon({ html: el('mlabel ' + c.cls, c.n), className: 'mwrap', iconSize: [0, 0] }),
      }).addTo(group)
      if (++n > 110) break
    }
  }
  map.on('moveend zoomend', update)
  update()
  return () => { map.off('moveend zoomend', update); group.remove() }
}
