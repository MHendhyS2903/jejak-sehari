import { rawSegments } from './behavior.js'
import { h01 } from './hash.js'

const TAU = Math.PI * 2
export const angDiff = (a, b) => {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

export function makeGraph(layout) {
  const adj = {}
  Object.keys(layout.nodes).forEach((k) => (adj[k] = []))
  layout.edges.forEach(([a, b]) => {
    const [ax, az] = layout.nodes[a]
    const [bx, bz] = layout.nodes[b]
    const d = Math.hypot(ax - bx, az - bz)
    adj[a].push([b, d])
    adj[b].push([a, d])
  })
  return { layout, adj }
}

function route(g, from, to) {
  if (from === to) return [from]
  const dist = { [from]: 0 }
  const prev = {}
  const open = new Set([from])
  while (open.size) {
    let u = null
    for (const k of open) if (u === null || dist[k] < dist[u]) u = k
    open.delete(u)
    if (u === to) break
    for (const [v, w] of g.adj[u]) {
      const nd = dist[u] + w
      if (dist[v] === undefined || nd < dist[v]) {
        dist[v] = nd
        prev[v] = u
        open.add(v)
      }
    }
  }
  const out = [to]
  while (out[0] !== from && prev[out[0]]) out.unshift(prev[out[0]])
  return out
}

const WALK = 1.45
const T_CAP = 1.8

function polyline(points, lane) {
  const pts = []
  points.forEach((p) => {
    const l = pts[pts.length - 1]
    if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 0.05) pts.push([...p])
  })
  if (pts.length < 2) pts.push([pts[0][0] + 0.01, pts[0][1]])
  const out = pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p
    const a = pts[i - 1]
    const b = pts[i + 1]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const l = Math.hypot(dx, dz) || 1
    return [p[0] + (dz / l) * lane, p[1] - (dx / l) * lane]
  })
  const cum = [0]
  for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]))
  return { pts: out, cum, len: cum[cum.length - 1] }
}

function pathAt(path, u) {
  const s = Math.min(1, Math.max(0, u)) * path.len
  let i = 1
  while (i < path.pts.length - 1 && path.cum[i] < s) i++
  const a = path.pts[i - 1]
  const b = path.pts[i]
  const f = (s - path.cum[i - 1]) / (path.cum[i] - path.cum[i - 1] || 1)
  return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) }
}

export function buildPlans(crew, layout, rateAt) {
  const g = makeGraph(layout)
  const L = layout
  const isHome = L.id === 'home'
  const per = crew.map((a, order) => ({ a, order, segs: rawSegments(a) }))
  const occ = new Map()
  const all = []
  per.forEach((p) => p.segs.forEach((sg) => all.push({ p, sg })))
  all.sort((x, y) => x.sg.s - y.sg.s || x.p.order - y.p.order)
  for (const { sg } of all) {
    if (!sg.alts) continue
    const free = sg.alts.find((c) => !(occ.get(c.key) || []).some(([s, e]) => sg.s < e && sg.e > s)) || sg.alts[0]
    ;(occ.get(free.key) || occ.set(free.key, []).get(free.key)).push([sg.s, sg.e])
    sg.rkey = free.key
    sg.pos = free.pos
    sg.yaw = free.yaw
    sg.via = free.via
    if (free.kind) sg.kind = free.kind
    if (free.anim) sg.anim = free.anim
    if (free.fx) sg.fx = free.fx
  }
  const plans = new Map()
  for (const { a, segs } of per) {
    const lane = (((a.seed || 0) % 7) - 3) * 0.045
    const list = []
    segs.forEach((sg, i) => {
      if (sg.follow && list.length) {
        const pv = list[list.length - 1]
        sg.pos = pv.pos
        sg.yaw = pv.yaw
        sg.via = pv.via
        sg.rkey = pv.rkey
      }
      list.push(sg)
    })
    if (!isHome) list.push({ s: a.model.leave, e: Infinity, kind: 'exit', key: 'exit', anim: 'Idle', fx: '', pos: L.door.spawn, yaw: L.door.yaw, via: L.door.node })
    list.forEach((sg, i) => {
      const prev = list[i - 1]
      const pre = i === 0
      const spawn = L.door.spawn
      if (isHome && pre) {
        sg.W = 0
        return
      }
      const fromPos = pre ? spawn : prev.pos
      const fromVia = pre ? L.door.node : prev.via
      const nodes = route(g, fromVia, sg.via).map((k) => L.nodes[k])
      const pts = [fromPos, ...(pre ? [] : [prev.pos]), ...nodes, sg.pos]
      const path = polyline(pts, lane)
      const r = Math.max(0.3, rateAt(sg.s))
      const T = Math.min(Math.max(path.len / 2.6, 0.6), r < 3 ? 5.5 : T_CAP)
      let W = Math.min(30, Math.max(0.8, T * r)) * (1 + 0.25 * h01(a.seed || 1, Math.floor(sg.s)))
      if (prev && sg.crit) W = Math.min(W, Math.max(0.6, (sg.s - prev.s) * 0.85))
      if (Number.isFinite(sg.e)) W = Math.min(W, Math.max(0.6, (sg.e - sg.s) * 0.4))
      if (sg.kind === 'exit') W = Math.min(W, 2.7)
      sg.path = path
      sg.W = W
      sg.vreal = path.len / Math.max(0.2, W / r)
      sg.r = r
      if (sg.crit && !pre) {
        sg.t0 = sg.s - W
      } else {
        sg.t0 = pre ? a.model.inStart : sg.s
        sg.s = sg.t0 + W
      }
    })
    plans.set(a.id, { segs: list, home: isHome, a })
  }
  return plans
}

const ease = (u) => u * u * (3 - 2 * u)

export function poseAt(plan, minute) {
  const segs = plan.segs
  if (!segs.length) return INVIS
  let i = -1
  for (let k = 0; k < segs.length; k++) {
    const start = segs[k].W === 0 || segs[k].t0 === undefined ? segs[k].s : segs[k].t0
    if (minute >= start) i = k
    else break
  }
  if (i < 0) return INVIS
  const sg = segs[i]
  const prev = segs[i - 1]
  const r = sg.r || 1
  const Tsit = Math.max(0.5, 0.55 * r)
  if (sg.kind === 'exit' && minute >= sg.s) return INVIS
  if (sg.t0 !== undefined && minute < sg.s && sg.W > 0) {
    const u = (minute - sg.t0) / sg.W
    const fromSeat = prev && prev.kind === 'seat'
    const out = fromSeat ? Math.min(1, (minute - sg.t0) / Tsit) : 1
    const sit = fromSeat ? 1 - out : 0
    const mv = fromSeat ? Math.max(0, (minute - sg.t0 - Tsit) / Math.max(0.1, sg.W - Tsit)) : u
    const p = pathAt(sg.path, ease(Math.min(1, mv)) * 0.35 + Math.min(1, mv) * 0.65)
    const near = Math.min(1, mv * 8)
    let yaw = p.yaw
    if (fromSeat && prev) yaw += angDiff(p.yaw, prev.yaw) * (1 - near)
    const end = Math.max(0, (mv - 0.88) / 0.12)
    yaw += angDiff(yaw, sg.yaw) * end
    const run = sg.vreal > 2.7
    return {
      visible: true, x: p.x, z: p.z, yaw, sit, fx: '', cup: !!sg.cup && u > 0.6, moving: sit < 0.05,
      anim: sit > 0.05 ? 'SitDown' : run ? 'Run' : 'Walk', speed: sg.vreal, seg: sg, blocked: false, goal: sg.pos,
      kind: 'transit',
    }
  }
  const t = minute - sg.s
  const sit = sg.kind === 'seat' ? Math.min(1, t / Tsit) : 0
  const seated = sg.kind === 'seat'
  return {
    visible: true, x: sg.pos[0], z: sg.pos[1], yaw: sg.yaw, sit, fx: sg.fx, cup: !!sg.cup,
    anim: seated ? (sit > 0.4 ? sg.anim : 'Idle') : sg.anim, speed: 1.45, seg: sg, moving: false, goal: sg.pos, kind: seated ? 'seat' : 'stand',
  }
}

const INVIS = { visible: false, sit: 0, kind: 'gone' }

export class Crowd {
  constructor(layout) {
    this.L = layout
    this.items = new Map()
    this.order = []
  }

  set(crew, rateAt) {
    this.plans = buildPlans(crew, this.L, rateAt)
    this.crew = crew
    this.order = crew.map((a) => a.id)
    this.items = new Map(crew.map((a) => [a.id, { info: a, pose: INVIS, look: 0 }]))
  }

  pose(id) {
    return this.items.get(id)?.pose || null
  }

  update(minute, snap) {
    for (const id of this.order) {
      const it = this.items.get(id)
      const p = poseAt(this.plans.get(id), minute)
      it.pose = p.visible ? { ...p, snap, look: 0 } : INVIS
    }
    this.separate()
    this.speakers(minute)
  }

  separate() {
    const arr = this.order.map((id) => this.items.get(id).pose).filter((p) => p.visible)
    const R = 0.3
    const mobile = (p) => p.kind === 'transit' || p.kind === 'stand'
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i]
          const b = arr[j]
          const ma = mobile(a)
          const mb = mobile(b)
          if (!ma && !mb) continue
          const dx = b.x - a.x
          const dz = b.z - a.z
          const d = Math.hypot(dx, dz)
          if (d >= R * 2) continue
          const nx = d > 1e-4 ? dx / d : 1
          const nz = d > 1e-4 ? dz / d : 0
          const push = (R * 2 - d) / 2
          const w = ma && mb ? 1 : 2
          if (ma) {
            a.x -= nx * push * w
            a.z -= nz * push * w
          }
          if (mb) {
            b.x += nx * push * w
            b.z += nz * push * w
          }
        }
      }
    }
    for (const p of arr) {
      if (p.kind !== 'transit') continue
      if (p.goal && Math.hypot(p.goal[0] - p.x, p.goal[1] - p.z) < 1.3) continue
      for (const r of this.L.obstacles || []) pushOut(p, 0.28, r)
    }
  }

  speakers(minute) {
    const seated = this.order.map((id) => this.items.get(id).pose).filter((p) => p.visible && p.kind === 'seat' && p.fx === 'meeting' && p.sit > 0.9)
    if (seated.length < 2) return
    const sp = seated[Math.floor(minute / 12) % seated.length]
    seated.forEach((p) => {
      if (p === sp) return
      p.look = Math.max(-0.7, Math.min(0.7, angDiff(p.yaw, Math.atan2(sp.x - p.x, sp.z - p.z))))
    })
  }
}

function pushOut(a, r, rect) {
  const [x0, z0, x1, z1] = rect
  const cx = Math.max(x0, Math.min(a.x, x1))
  const cz = Math.max(z0, Math.min(a.z, z1))
  const dx = a.x - cx
  const dz = a.z - cz
  const d = Math.hypot(dx, dz)
  if (d >= r) return
  if (d > 1e-4) {
    a.x = cx + (dx / d) * r
    a.z = cz + (dz / d) * r
  } else {
    const opts = [[a.x - x0, -1, 0], [x1 - a.x, 1, 0], [a.z - z0, 0, -1], [z1 - a.z, 0, 1]].sort((p, q) => p[0] - q[0])[0]
    a.x += opts[1] * (opts[0] + r)
    a.z += opts[2] * (opts[0] + r)
  }
}
