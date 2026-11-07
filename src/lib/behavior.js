import { OFFICE, HOME } from '../data/layouts.js'
import { EXIT_IN_MIN } from './timeline.js'
import { h01 } from './hash.js'

export const ZONE = { kerja: 'Area Kerja', meeting: 'Ruang Meeting', pantry: 'Pantry', lounge: 'Lounge', jalan: 'Di jalan', rumah: 'Rumah', wfh: 'WFH' }

const BLOCK = 45
const alt = (key, pos, yaw, via) => ({ key, pos, yaw, via })
const seatAlts = (prefix, list, order) =>
  (order || list.map((_, i) => i)).map((i) => alt(`${prefix}${i}`, list[i].seat, list[i].yaw, list[i].via))
const standAlts = (items) => items.map(([k, p]) => alt(k, p.pos, p.yaw, p.via))

function ambientSeg(a, s, e) {
  const L = OFFICE
  const b = Math.floor(s / BLOCK)
  const desk = { kind: 'seat', key: 'desk', anim: 'SitIdle', fx: 'typing', alts: [alt('desk', L.desks[a.desk].seat, L.desks[a.desk].yaw, L.desks[a.desk].via)] }
  if (a.noAmbient) return { s, e, ...desk }
  const prevCoffee = h01(a.seed, b - 1) > 0.78 && h01(a.seed, b - 1) <= 0.86
  const rp = h01(a.pair, b, 11)
  if (rp < 0.16 && a.pair > 0) {
    const g = Math.floor(h01(a.pair, b, 5) * L.chat.length)
    const spot = L.chat[g][Math.min(a.pairIdx, L.chat[g].length - 1)]
    return { s, e, kind: 'stand', key: `chat${g}_${a.pairIdx}`, anim: 'Idle', fx: 'talk', alts: [alt(`chat${g}_${a.pairIdx}`, spot.pos, spot.yaw, spot.via)] }
  }
  const r = h01(a.seed, b)
  if (r < 0.62) return { s, e, ...desk, cup: prevCoffee }
  if (r < 0.7) return { s, e, kind: 'stand', key: 'prn', anim: 'Idle', fx: 'idle', alts: standAlts([['prn', L.printer]]) }
  if (r < 0.78) return { s, e, kind: 'stand', key: 'cofA', anim: 'Idle', fx: 'coffee', cup: true, alts: standAlts([['cofA', L.coffee], ['cofB', L.fridge]]) }
  if (r < 0.9) return { s, e, kind: 'seat', key: 'cv', anim: 'SitTalk', fx: 'talk', alts: seatAlts('cv', L.couchSeats) }
  return { s, e, ...desk }
}

export function rawSegments(a) {
  const wm = a.model
  const segs = []
  if (wm.wfh) {
    const desk = HOME.desks[0]
    const mk = (s, e, it) => {
      if (it?.type === 'fokus') return { s, e, kind: 'seat', key: 'h-desk', anim: 'SitIdle', fx: 'typing', alts: [alt('h-desk', desk.seat, desk.yaw, desk.via)] }
      if (it?.type === 'meeting') return { s, e, kind: 'seat', key: 'h-desk', anim: 'SitTalk', fx: 'call', alts: [alt('h-desk', desk.seat, desk.yaw, desk.via)] }
      return { s, e, kind: 'seat', key: 'h-cv', anim: 'SitIdle', fx: 'idle', alts: seatAlts('h-cv', HOME.couchSeats) }
    }
    const pts = [...new Set([wm.t0, wm.t1, ...wm.items.flatMap((i) => [i.start, i.end])])].filter((t) => t >= wm.t0 && t <= wm.t1).sort((x, y) => x - y)
    for (let i = 1; i < pts.length; i++) {
      const mid = (pts[i - 1] + pts[i]) / 2
      segs.push(mk(pts[i - 1], pts[i], wm.items.find((it) => mid >= it.start && mid < it.end)))
    }
    return merge(segs)
  }
  const L = OFFICE
  const start = wm.inStart
  const end = wm.leave
  const pts = new Set([start, end])
  wm.items.forEach((i) => {
    pts.add(Math.min(end, Math.max(start, i.start)))
    pts.add(Math.min(end, Math.max(start, i.end)))
  })
  const sorted = [...pts].sort((x, y) => x - y)
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i - 1]
    const e = sorted[i]
    if (e - s < 0.5) continue
    const item = wm.items.find((it) => s >= it.start - 0.01 && e <= it.end + 0.01)
    if (!item) {
      for (let t = s; t < e - 0.5; ) {
        const nt = Math.min(e, (Math.floor(t / BLOCK) + 1) * BLOCK)
        segs.push(ambientSeg(a, t, nt))
        t = nt
      }
      continue
    }
    const len = item.end - item.start
    if (item.type === 'fokus') {
      segs.push({ s, e, kind: 'seat', key: 'desk', anim: 'SitIdle', fx: 'typing', alts: [alt('desk', L.desks[a.desk].seat, L.desks[a.desk].yaw, L.desks[a.desk].via)] })
    } else if (item.type === 'meeting') {
      const idx = (item.seat ?? a.meetSeat ?? 0) % L.meet.length
      const order = [idx, ...L.meet.map((_, k) => k).filter((k) => k !== idx)]
      const clap = h01(a.seed, item.start, 3) < 0.6
      const clapLen = Math.min(4, len * 0.08)
      const sitEnd = clap && e >= item.end - 0.01 ? e - clapLen : e
      if (sitEnd > s) segs.push({ s, e: sitEnd, kind: 'seat', key: 'meet', anim: 'SitTalk', fx: 'meeting', crit: true, alts: seatAlts('meet', L.meet, order) })
      if (sitEnd < e) segs.push({ s: sitEnd, e, kind: 'stand', key: 'clap', anim: 'Clapping', fx: 'clap', follow: 'meet' })
    } else {
      const cEnd = s + Math.min(len * 0.16, e - s)
      segs.push({ s, e: cEnd, kind: 'stand', key: 'cofA', anim: 'Idle', fx: 'coffee', cup: false, crit: true, alts: standAlts([['cofA', L.coffee], ['cofB', L.fridge]]) })
      if (e > cEnd) {
        const k = Math.floor(h01(a.seed, item.start, 9) * 10)
        const bar = seatAlts('bar', L.bar).map((x) => ({ ...x, kind: 'seat', anim: 'SitIdle', fx: 'sip' }))
        const pt = seatAlts('pt', L.pantryTables).map((x) => ({ ...x, kind: 'seat', anim: 'SitTalk', fx: 'sip' }))
        const st = L.pantryStand.map((p, i) => ({ ...alt(`ps${i}`, p.pos, p.yaw, p.via), kind: 'stand', anim: 'Idle', fx: 'talk' }))
        const first = k < 5 ? [...bar, ...pt] : [...pt, ...bar]
        segs.push({ s: cEnd, e, kind: 'seat', key: 'pant', anim: 'SitIdle', fx: 'sip', cup: true, alts: [...first, ...st] })
      }
    }
  }
  return merge(segs)
}

function merge(segs) {
  const out = []
  for (const g of segs) {
    const p = out[out.length - 1]
    if (p && p.key === g.key && p.kind === g.kind && p.fx === g.fx && Math.abs(p.e - g.s) < 0.01 && !g.follow) p.e = g.e
    else out.push({ ...g })
  }
  return out
}

export function statusAt(wm, minute, a) {
  const item = wm.items.find((it) => minute >= it.start && minute < it.end)
  const next = wm.items.find((it) => it.start > minute)
  if (wm.wfh) {
    if (item) return { loc: 'wfh', zone: 'WFH', act: item.type, until: item.end }
    return { loc: 'wfh', zone: 'WFH', act: 'lain', until: next ? next.start : null }
  }
  if (minute < wm.depart) return { loc: 'rumah', zone: 'Di rumah', act: 'belum', until: wm.depart }
  if (minute < wm.inStart) return { loc: 'jalan', zone: 'Di jalan', act: 'berangkat', until: wm.inStart }
  if (minute >= wm.leave + EXIT_IN_MIN + 3 && minute < wm.arriveHome) return { loc: 'jalan', zone: 'Di jalan', act: 'pulang', until: wm.arriveHome }
  if (minute >= wm.arriveHome) return { loc: 'rumah', zone: 'Di rumah', act: 'selesai', until: null }
  if (minute >= wm.leave) return { loc: 'kantor', zone: 'Area Kerja', act: 'pulang-keluar', until: wm.leave + EXIT_IN_MIN + 3 }
  if (item) {
    const zone = item.type === 'meeting' ? ZONE.meeting : item.type === 'istirahat' ? ZONE.pantry : ZONE.kerja
    return { loc: 'kantor', zone, act: item.type, until: item.end }
  }
  let zone = ZONE.kerja
  let act = 'lain'
  if (a) {
    const b = Math.floor(minute / BLOCK)
    const rp = h01(a.pair, b, 11)
    const r = h01(a.seed, b)
    if (!a.noAmbient) {
      if (rp < 0.16) { zone = 'Area Kerja'; act = 'ngobrol' }
      else if (r >= 0.62 && r < 0.7) { zone = 'Area Kerja'; act = 'printer' }
      else if (r >= 0.7 && r < 0.78) { zone = ZONE.pantry; act = 'kopi' }
      else if (r >= 0.78 && r < 0.9) { zone = ZONE.lounge; act = 'diskusi' }
    }
  }
  return { loc: 'kantor', zone, act, until: next ? Math.min(next.start, wm.leave) : wm.leave }
}

export const ACT_LABEL = {
  meeting: 'Meeting', istirahat: 'Istirahat', fokus: 'Kerja fokus', lain: 'Bekerja', ngobrol: 'Ngobrol', printer: 'Ke printer', kopi: 'Ambil kopi', diskusi: 'Diskusi santai',
  belum: 'Belum berangkat', berangkat: 'Menuju kantor', pulang: 'Pulang', 'pulang-keluar': 'Bersiap pulang', selesai: 'Sudah pulang',
}
