export const W = 22
export const H = 12
export const TILE = 2
export const LANE = 0.31

export const cellToWorld = (c, r) => [(c - (W - 1) / 2) * TILE, (r - (H - 1) / 2) * TILE]

const DIRS = [[1, 0], [0, -1], [-1, 0], [0, 1]]
const E = 0
const Sx = 3

export const HOME_CELL = [5, 3]
export const OFFICE_CELL = [17, 4]
export const RING = { c0: 9, c1: 13, r0: 4, r1: 8 }
export const AVENUE_ROWS = [5, 6, 7]

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const key = (c, r) => `${c},${r}`

function roadMasks() {
  const masks = new Map()
  const touch = (c, r) => masks.set(key(c, r), masks.get(key(c, r)) || 0)
  const link = (c, r, d) => {
    masks.set(key(c, r), (masks.get(key(c, r)) || 0) | (1 << d))
    const nc = c + DIRS[d][0]
    const nr = r + DIRS[d][1]
    masks.set(key(nc, nr), (masks.get(key(nc, nr)) || 0) | (1 << ((d + 2) % 4)))
  }
  const chain = (pts) => {
    pts.forEach(([c, r]) => touch(c, r))
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = pts[i - 1]
      const [c, d] = pts[i]
      const dir = DIRS.findIndex(([x, y]) => a + x === c && b + y === d)
      link(a, b, dir)
    }
  }
  const row = (r, c0, c1) => chain(Array.from({ length: c1 - c0 + 1 }, (_, i) => [c0 + i, r]))
  const col = (c, r0, r1) => chain(Array.from({ length: r1 - r0 + 1 }, (_, i) => [c, r0 + i]))
  row(2, 0, 21)
  row(10, 0, 21)
  AVENUE_ROWS.forEach((r) => {
    row(r, 0, RING.c0)
    row(r, RING.c1, 21)
  })
  row(RING.r0, RING.c0, RING.c1)
  row(RING.r1, RING.c0, RING.c1)
  col(RING.c0, RING.r0, RING.r1)
  col(RING.c1, RING.r0, RING.r1)
  ;[3, 7, 15, 19].forEach((c) => col(c, 0, H - 1))
  return masks
}

function tileFor(mask) {
  const bits = [0, 1, 2, 3].filter((d) => mask & (1 << d))
  if (bits.length === 1) return tileFor(mask | (1 << ((bits[0] + 2) % 4)))
  if (bits.length === 4) return { type: 'junction', k: 0 }
  if (bits.length === 3) {
    const missing = [0, 1, 2, 3].find((d) => !(mask & (1 << d)))
    return { type: 'tsplit', k: (missing - 2 + 4) % 4 }
  }
  if (mask & 1 && mask & 4) return { type: 'straight', k: 1 }
  if (mask & 2 && mask & 8) return { type: 'straight', k: 0 }
  const s = [0, 1, 2, 3].find((d) => mask & (1 << d) && mask & (1 << ((d + 1) % 4)))
  return { type: 'corner', k: (s - 3 + 4) % 4 }
}

export const isRingCell = (c, r) => c >= RING.c0 && c <= RING.c1 && r >= RING.r0 && r <= RING.r1
const isPlaza = (c, r) => c > RING.c0 && c < RING.c1 && r > RING.r0 && r < RING.r1

const TOWERS = ['a', 'b', 'c', 'd', 'e']
const TOWER_H = { a: 2.88, b: 3.3, c: 3.5, d: 3.9, e: 4.08 }
const RUKO = 'abcdefghijklm'.split('')

export function buildLayout(thin = false) {
  const rnd = mulberry32(2026)
  const rl = mulberry32(77)
  const drop = (p) => thin && rl() < p
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const masks = roadMasks()
  const isRoad = (c, r) => masks.has(key(c, r))
  const out = {
    roads: { straight: [], crossing: [], corner: [], tsplit: [], junction: [] },
    base: [],
    models: {},
    glass: [],
    poles: [],
    signs: [],
    roofs: [],
    lamps: [],
    signals: [],
    carts: [],
    ojek: [],
    busway: [],
    podium: null,
    homeTop: null,
    officeTower: null,
    junctions: [],
  }
  const M = (name, item) => (out.models[name] ||= []).push(item)

  for (const [k, mask] of masks) {
    const [c, r] = k.split(',').map(Number)
    const [x, z] = cellToWorld(c, r)
    const { type, k: rot } = tileFor(mask)
    let t = type
    if (type === 'straight' && (c * 7 + r * 3) % 7 === 0 && c > 0 && r > 0 && c < W - 1 && r < H - 1 && !isRingCell(c, r)) t = 'crossing'
    out.roads[t].push({ x, y: 0, z, rot: (rot * Math.PI) / 2, s: 1 })
    if (r === 6 && type === 'straight' && !isRingCell(c, r)) out.busway.push({ x, z, rot: (rot * Math.PI) / 2 })
    if ((type === 'junction' || type === 'tsplit') && !isRingCell(c, r) && AVENUE_ROWS.includes(r)) {
      out.junctions.push({ c, r, x, z, type })
    }
  }
  ;[3, 7, 15, 19].forEach((c) => {
    const [x] = cellToWorld(c, 0)
    const [, zn] = cellToWorld(0, 4)
    const [, zs] = cellToWorld(0, 8)
    ;[[x - 1.15, zn + 1.0, 'h'], [x + 1.15, zs - 1.0, 'h'], [x - 1.15, zs - 1.0, 'v'], [x + 1.15, zn + 1.0, 'v']].forEach(([px, pz, axis]) =>
      out.signals.push({ x: px, z: pz, axis }),
    )
  })

  const front = (c, r) => {
    for (const d of [3, 1, 0, 2]) if (isRoad(c + DIRS[d][0], r + DIRS[d][1])) return (((d - 3 + 4) % 4) * Math.PI) / 2
    return Math.floor(rnd() * 4) * (Math.PI / 2)
  }
  const tower = (c, r, letter, opts = {}) => {
    const [x, z] = cellToWorld(c, r)
    const sxz = opts.s ?? 1.2
    const hTarget = opts.h ?? 5.5 + rnd() * 2
    const item = { x, y: opts.y ?? 0.1, z, rot: opts.rot ?? front(c, r), s: sxz, sy: hTarget / (TOWER_H[letter] * sxz), color: opts.color }
    M(`jakarta/building-skyscraper-${letter}`, item)
    return { ...item, h: hTarget, letter }
  }
  const glass = (c, r, h, w = 1.65) => {
    const [x, z] = cellToWorld(c, r)
    out.glass.push({ x, z, w, h, rot: front(c, r), tint: rnd() })
  }
  const ruko = (c, r) => {
    const [x, z] = cellToWorld(c, r)
    const rot = front(c, r)
    const letter = pick(RUKO)
    const floors = rnd() < 0.45 ? 1.25 : 1
    const item = { x, y: 0.1, z, rot, s: 2.0, sy: floors, color: pick(['#ffffff', '#f6e7cf', '#efd9d0', '#dde8ee', '#e6efd6', '#f2dcc2']) }
    M(`jakarta/building-${letter}`, item)
    const hgt = 1.29 * 2 * floors
    const fx = Math.sin(rot) * 0.98
    const fz = Math.cos(rot) * 0.98
    if (rnd() < 0.75) M('jakarta/detail-awning-wide', { x: x + fx, y: 0.1 + 0.55, z: z + fz, rot, s: 2.2, color: pick(['#d9534f', '#2f7fd1', '#e6a82e', '#3aa76d', '#9b59b6']) })
    out.signs.push({ x: x + Math.sin(rot) * 1.02, y: 0.1 + 1.05, z: z + Math.cos(rot) * 1.02, rot, type: Math.floor(rnd() * 6) })
    if (rnd() < 0.35) {
      const w = 1.7
      out.roofs.push({ x, y: 0.1 + hgt, z, rot, w, d: 1.7, color: pick(['#b5532f', '#9c4a2a', '#8a8f94', '#a7acb1']), kind: rnd() < 0.6 ? 'genteng' : 'seng' })
    }
    if (rnd() < 0.18) out.carts.push({ x: x + Math.sin(rot) * 1.0 + Math.cos(rot) * 0.55, z: z + Math.cos(rot) * 1.0 - Math.sin(rot) * 0.55, rot, color: pick(['#d9534f', '#e6a82e', '#2f7fd1']) })
    return item
  }
  const plaza = (c, r, trees = 2) => {
    const [x, z] = cellToWorld(c, r)
    out.base.push({ x, y: 0, z, rot: 0, s: 1 })
    if (thin) trees = drop(0.5) ? 0 : 1
    for (let i = 0; i < trees; i++) {
      const name = pick(['jakarta/tree_palmTall', 'jakarta/tree_palm', 'jakarta/tree_default', 'jakarta/tree_oak'])
      M(name, { x: x + (rnd() - 0.5) * 1.3, y: 0.1, z: z + (rnd() - 0.5) * 1.3, rot: rnd() * 6, s: 1.1 + rnd() * 0.4 })
    }
    if (!thin && rnd() < 0.6) M('jakarta/plant_bushLarge', { x: x + (rnd() - 0.5), y: 0.1, z: z + (rnd() - 0.5), rot: rnd() * 6, s: 1.2 })
  }

  const [hc, hr] = HOME_CELL
  const [oc, or] = OFFICE_CELL
  const homeTowers = new Set(['4,3', '5,3', '6,3', '4,4', '6,4', '5,1'])
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (isRoad(c, r)) continue
      const [x, z] = cellToWorld(c, r)
      if (isPlaza(c, r)) {
        out.base.push({ x, y: 0, z, rot: 0, s: 1 })
        continue
      }
      const edge = r === 0 || r === H - 1 || c === 0 || c === W - 1
      if (c === 18 && (r === 4 || r === 8)) {
        plaza(c, r, 1)
        continue
      }
      if (homeTowers.has(key(c, r))) {
        const home = c === hc && r === hr
        const heights = { '4,3': 6.2, '5,3': 8.6, '6,3': 6.9, '4,4': 5.4, '6,4': 5.8, '5,1': 6.0 }
        const cell = tower(c, r, home ? 'd' : pick(['a', 'b', 'c']), { s: 1.15, h: heights[key(c, r)], y: r >= 3 ? 1.2 : 0.1, color: '#f4ead6' })
        if (home) out.homeTop = { x: cell.x, z: cell.z, y: cell.y + cell.h }
        continue
      }
      if (c >= 4 && c <= 6 && r >= 3 && r <= 4) {
        out.base.push({ x, y: 0, z, rot: 0, s: 1 })
        continue
      }
      if (c === oc && r === or) {
        const cell = tower(c, r, 'e', { s: 1.42, h: 13.5, color: '#bcd6ee' })
        out.officeTower = cell
        continue
      }
      if (thin && !edge && drop(c <= 8 ? 0.6 : 0.7)) {
        out.base.push({ x, y: 0, z, rot: 0, s: 1 })
        continue
      }
      if (c <= 8) {
        if (edge && rnd() < 0.8) plaza(c, r, 1)
        else if (rnd() < 0.42) plaza(c, r, 2)
        else ruko(c, r)
        continue
      }
      if (c <= 14) {
        if (rnd() < 0.62) plaza(c, r, 2)
        else if (rnd() < 0.45) glass(c, r, 5 + rnd() * 4)
        else tower(c, r, pick(TOWERS), { s: 1.3, h: 5.5 + rnd() * 4, color: pick(['#cfe0ee', '#e8eef2', '#d7e6e2']) })
        continue
      }
      if (edge && rnd() < 0.8) plaza(c, r, 1)
      else if (rnd() < 0.55) plaza(c, r, 3)
      else if (rnd() < 0.45) glass(c, r, 6 + rnd() * 5)
      else tower(c, r, pick(TOWERS), { s: 1.35, h: 6 + rnd() * 5, color: pick(['#c5d9ec', '#dfe8ee', '#cddfd8']) })
    }
  }
  const [px, pz] = cellToWorld(5, 3.5)
  out.podium = { x: px, z: pz, w: 6.0, d: 4.0, h: 1.2 }

  const [x0] = cellToWorld(0, 0)
  const [x1] = cellToWorld(W - 1, 0)
  for (let x = x0 + 1; x <= x1 - 1; x += thin ? 3.8 : 1.9) {
    const c = Math.round(x / TILE + (W - 1) / 2)
    const inRing = c >= RING.c0 && c <= RING.c1
    const nearCross = [3, 7, 15, 19].some((cc) => Math.abs(x - cellToWorld(cc, 0)[0]) < 1.3)
    if (nearCross || inRing) continue
    const haltePos = [cellToWorld(5, 0)[0] + 1, cellToWorld(17, 0)[0] - 1].some((hx) => Math.abs(x - hx) < 2.6) || (x > 4.5 && x < 15)
    const name = rnd() < 0.7 ? 'jakarta/tree_palmTall' : 'jakarta/tree_palm'
    if (!haltePos) M(name, { x, y: 0.1, z: 0, rot: rnd() * 6, s: 1.05 })
    M(name, { x: x + 0.9, y: 0.1, z: 2, rot: rnd() * 6, s: 1.0 })
  }
  for (let c = 15; c <= 21; c += 1) {
    const [x] = cellToWorld(c, 0)
    ;[[4, 1.0], [8, -1.0]].forEach(([r, o]) => {
      const [, z] = cellToWorld(0, r)
      if (!isRoad(c, r) && rnd() < (thin ? 0.2 : 0.5)) M('jakarta/tree_default', { x: x + (rnd() - 0.5), y: 0.1, z: z + o * 0.95, rot: rnd() * 6, s: 1.4 })
    })
  }
  const [bx, bz] = cellToWorld(11, 6)
  ;(thin ? [[-1.5, -1.5], [1.5, 1.5]] : [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5], [0, -1.6], [0, 1.6]]).forEach(([dx, dz]) => M('jakarta/tree_palmTall', { x: bx + dx, y: 0.1, z: bz + dz, rot: rnd() * 6, s: 1.1 }))
  M('jakarta/fountain-round-detail', { x: bx, y: 0.1, z: bz, rot: 0, s: 0.72 })
  out.plazaCenter = [bx, bz]

  for (let x = x0 + 2; x <= x1 - 2; x += 5) {
    const c = Math.round(x / TILE + (W - 1) / 2)
    if (c >= RING.c0 && c <= RING.c1) continue
    if ([3, 7, 15, 19].some((cc) => Math.abs(x - cellToWorld(cc, 0)[0]) < 1.4)) continue
    const [, zn] = cellToWorld(0, 5)
    const [, zs] = cellToWorld(0, 7)
    out.lamps.push({ x, z: zn - 0.86, rot: -Math.PI / 2 }, { x: x + 2.5, z: zs + 0.86, rot: Math.PI / 2 })
  }
  const poleSide = (pts) => pts.forEach((p) => out.poles.push(p))
  ;[3, 7].forEach((c) => {
    const [x] = cellToWorld(c, 0)
    for (let r = 8; r <= 11; r++) {
      const [, z] = cellToWorld(0, r)
      poleSide([{ x: x + 0.88, z, line: `v${c}` }])
    }
  })
  for (let c = 0; c <= 8; c++) {
    const [x] = cellToWorld(c, 0)
    const [, z] = cellToWorld(0, 10)
    if (![3, 7].includes(c)) poleSide([{ x, z: z - 0.88, line: 'h10' }])
  }
  for (let c = 0; c <= 8; c++) {
    const [x] = cellToWorld(c, 0)
    const [, z] = cellToWorld(0, 2)
    if (![3, 7].includes(c)) poleSide([{ x, z: z + 0.88, line: 'h2' }])
  }
  const [ox, oz] = cellToWorld(oc, or)
  out.ojek.push({ x: ox + 1.45, z: oz + 0.62, rot: Math.PI / 2 })
  const [kx, kz] = cellToWorld(2, 4)
  out.ojek.push({ x: kx + 0.5, z: kz + 0.62, rot: Math.PI / 2 })
  const [mx, mz] = cellToWorld(5, 8)
  out.ojek.push({ x: mx + 0.5, z: mz - 0.62, rot: -Math.PI / 2 })
  return out
}

const off = (d) => [LANE * d[1], -LANE * d[0]]

export function expandTiles(wp) {
  const out = [wp[0]]
  for (let i = 1; i < wp.length; i++) {
    let [c, r] = out[out.length - 1]
    const [tc, tr] = wp[i]
    while (c !== tc || r !== tr) {
      if (c !== tc) c += Math.sign(tc - c)
      else r += Math.sign(tr - r)
      out.push([c, r])
    }
  }
  return out
}

const sub = (a, b) => {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l = Math.hypot(dx, dz) || 1
  return [dx / l, dz / l]
}

export function makePath(tiles, { closed = false, radius = 0.8 } = {}) {
  const centers = tiles.map(([c, r]) => cellToWorld(c, r))
  const n = centers.length
  const pts = []
  const tileIdx = []
  const quad = (a, m, b) => {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      pts.push([
        (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * m[0] + t * t * b[0],
        (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * m[1] + t * t * b[1],
      ])
    }
  }
  for (let i = 0; i < n; i++) {
    const prev = closed ? centers[(i - 1 + n) % n] : centers[i - 1]
    const next = closed ? centers[(i + 1) % n] : centers[i + 1]
    const dIn = prev ? sub(prev, centers[i]) : sub(centers[i], next)
    const dOut = next ? sub(centers[i], next) : dIn
    const c = centers[i]
    const oIn = off(dIn)
    const oOut = off(dOut)
    const turn = Math.abs(dIn[0] * dOut[1] - dIn[1] * dOut[0]) > 0.5
    if (turn) {
      const m = [c[0] + oIn[0] + oOut[0], c[1] + oIn[1] + oOut[1]]
      const start = pts.length
      quad([m[0] - dIn[0] * radius, m[1] - dIn[1] * radius], m, [m[0] + dOut[0] * radius, m[1] + dOut[1] * radius])
      tileIdx.push(start + 5)
    } else {
      pts.push([c[0] + oIn[0], c[1] + oIn[1]])
      tileIdx.push(pts.length - 1)
    }
  }
  if (closed) pts.push(pts[0])
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const length = cum[cum.length - 1]

  const at = (s, o = {}) => {
    if (closed) s = ((s % length) + length) % length
    else s = Math.min(length, Math.max(0, s))
    let lo = 0
    let hi = cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cum[mid] <= s) lo = mid
      else hi = mid
    }
    const seg = cum[hi] - cum[lo] || 1
    const f = (s - cum[lo]) / seg
    o.x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f
    o.z = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f
    const dx = pts[hi][0] - pts[lo][0]
    const dz = pts[hi][1] - pts[lo][1]
    const l = Math.hypot(dx, dz) || 1
    o.dx = dx / l
    o.dz = dz / l
    return o
  }
  const tileS = tileIdx.map((i) => cum[i])
  return { length, at, tileS, tiles, closed }
}

const rect = (c0, r0, c1, r1) => expandTiles([[c0, r0], [c1, r0], [c1, r1], [c0, r1], [c0, r0]]).slice(0, -1)

function busLoop(row, c0, c1) {
  const [xa] = cellToWorld(c0, row)
  const [xb] = cellToWorld(c1, row)
  const [, zc] = cellToWorld(c0, row)
  const zE = zc - LANE
  const zW = zc + LANE
  const pts = []
  for (let x = xa - 1; x <= xb + 1; x += 0.5) pts.push([x, zE])
  for (let i = 1; i < 8; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 8
    pts.push([xb + 1 + Math.cos(a) * LANE, zc + Math.sin(a) * LANE])
  }
  for (let x = xb + 1; x >= xa - 1; x -= 0.5) pts.push([x, zW])
  for (let i = 1; i < 8; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 8
    pts.push([xa - 1 + Math.cos(a) * LANE, zc + Math.sin(a) * LANE])
  }
  pts.push(pts[0])
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const length = cum[cum.length - 1]
  const at = (s, o = {}) => {
    s = ((s % length) + length) % length
    let lo = 0
    let hi = cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cum[mid] <= s) lo = mid
      else hi = mid
    }
    const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1)
    o.x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f
    o.z = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f
    const dx = pts[hi][0] - pts[lo][0]
    const dz = pts[hi][1] - pts[lo][1]
    const l = Math.hypot(dx, dz) || 1
    o.dx = dx / l
    o.dz = dz / l
    return o
  }
  return { length, at, tileS: [], tiles: [], closed: true, bus: true, xa, xb }
}

const OUT_TILES = [[5, 5], [9, 5], [9, 4], [13, 4], [13, 5], [17, 5]]
const BACK_TILES = [[17, 5], [19, 5], [19, 7], [13, 7], [13, 8], [9, 8], [9, 7], [7, 7], [7, 5], [5, 5]]

const LOOP_TILES = [
  expandTiles([[3, 7], [9, 7], [9, 4], [13, 4], [13, 7], [19, 7], [19, 10], [3, 10], [3, 7]]).slice(0, -1),
  expandTiles([[19, 5], [13, 5], [13, 8], [9, 8], [9, 5], [3, 5], [3, 2], [19, 2], [19, 5]]).slice(0, -1),
  rect(3, 2, 7, 5),
  rect(3, 7, 7, 10),
  rect(15, 2, 19, 5),
  rect(15, 7, 19, 10),
  rect(9, 4, 13, 8),
]

const HOME_VARIANTS = [
  { head: [[5, 5]], tail: [[7, 7], [7, 5], [5, 5]] },
  { head: [[0, 5]], tail: [[7, 7], [7, 5], [0, 5]] },
  { head: [[3, 2], [3, 5]], tail: [[7, 7], [7, 5], [3, 5], [3, 2]] },
  { head: [[3, 10], [3, 5]], tail: [[7, 7], [7, 5], [3, 5], [3, 10]] },
  { head: [[7, 2], [7, 5]], tail: [[7, 7], [7, 2]] },
  { head: [[7, 10], [7, 5]], tail: [[7, 7], [7, 10]] },
  { head: [[0, 2], [3, 2], [3, 5]], tail: [[7, 7], [7, 5], [3, 5], [3, 2], [0, 2]] },
  { head: [[0, 10], [3, 10], [3, 5]], tail: [[7, 7], [7, 5], [3, 5], [3, 10], [0, 10]] },
]
export const HOME_VARIANT_COUNT = HOME_VARIANTS.length

export const homeStart = (v = 0) => cellToWorld(...HOME_VARIANTS[v % HOME_VARIANTS.length].head[0])

export function variantPaths(v = 0) {
  const { head, tail } = HOME_VARIANTS[v % HOME_VARIANTS.length]
  const out = makePath(expandTiles([...head, ...OUT_TILES.slice(1)]))
  const back = makePath(expandTiles([...BACK_TILES.slice(0, -3), ...tail]))
  return { out, back }
}

export function buildRoutes() {
  const mk = (tiles, opt) => makePath(tiles, opt)
  const out = mk(expandTiles(OUT_TILES))
  const back = mk(expandTiles(BACK_TILES))
  const loops = LOOP_TILES.map((t) => mk(t, { closed: true }))
  const buses = [busLoop(6, 0, 8), busLoop(6, 14, 21)]
  return { out, back, loops, buses }
}

export const homePos = () => cellToWorld(...HOME_CELL)
export const officePos = () => cellToWorld(...OFFICE_CELL)
