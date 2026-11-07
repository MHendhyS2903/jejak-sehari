import { DAYS } from './time.js'
import { makeEvent } from './schedule.js'
import { buildDay } from './timeline.js'
import { makeTravel } from './estimate.js'
import { h01, hashStr } from './hash.js'
import { HAIRS, PANTS, SHIRTS, SKINS } from './recolor.js'
import { commuteFor, homeAt, variantFor } from './homes.js'

const NAMES = ['Andi', 'Sari', 'Rizky', 'Dewi', 'Bayu', 'Putri', 'Fajar', 'Nadia', 'Yoga', 'Intan', 'Dimas', 'Laras', 'Hendra', 'Maya', 'Rani', 'Teguh']
const ROLES = ['Developer', 'QA', 'PM', 'Analis', 'Desainer', 'Admin']
export const BASES = ['male_suit', 'male_shirt', 'male_longsleeve', 'male_casual', 'female_alternative', 'female_casual', 'female_dress']
const NPC_COUNT = 14
export const MAX_WORKERS = 16
export const USER_DESK = 6

const hm = (h, m = 0) => h * 60 + m

export function buildRoster(extras = []) {
  const desks = Array.from({ length: 16 }, (_, i) => i).filter((i) => i !== USER_DESK)
  desks.sort((a, b) => h01(a, 77) - h01(b, 77))
  const kept = Math.max(0, Math.min(NPC_COUNT, MAX_WORKERS - 1 - extras.length))
  const npcs = Array.from({ length: kept }, (_, i) => {
    const id = `npc${i + 1}`
    const seed = hashStr(id)
    const base = BASES[Math.floor(h01(seed, 1) * BASES.length)]
    const home = homeAt(i)
    return {
      id, name: NAMES[i % NAMES.length], role: ROLES[Math.floor(h01(seed, 2) * ROLES.length)], base, seed,
      desk: desks[i], pair: Math.floor((i + 1) / 2) + 1, pairIdx: (i + 1) % 2, commute: commuteFor(home), home, homeV: variantFor(home, i),
      look: {
        shirt: SHIRTS[Math.floor(h01(seed, 4) * SHIRTS.length)],
        pants: PANTS[Math.floor(h01(seed, 5) * PANTS.length)],
        hair: HAIRS[Math.floor(h01(seed, 6) * HAIRS.length)],
        skin: SKINS[Math.floor(h01(seed, 7) * SKINS.length)],
      },
    }
  })
  const ext = extras.slice(0, MAX_WORKERS - 1 - kept).map((w, j) => {
    const home = homeAt(`${w.id || ''}${w.name || ''}`)
    return { ...w, desk: desks[kept + j], pair: 40 + j, pairIdx: 0, home, homeV: variantFor(home, j) }
  })
  return npcs.concat(ext)
}

function npcDay(w, dayIdx, wfh) {
  const s = w.seed
  const arrive = hm(7, 30) + Math.floor(h01(s, dayIdx, 1) * 120)
  const leave = hm(16, 30) + Math.floor(h01(s, dayIdx, 2) * 120)
  const lunchStart = hm(11, 30) + Math.floor(h01(s, dayIdx, 3) * 75)
  const lunchLen = 45 + Math.floor(h01(s, dayIdx, 4) * 20)
  const items = [{ type: 'istirahat', start: lunchStart, end: lunchStart + lunchLen }]
  const starts = [hm(9), hm(10), hm(14), hm(15), hm(16)]
  const n = 1 + Math.floor(h01(s, dayIdx, 5) * 3)
  for (let k = 0; k < n; k++) {
    const st = starts[Math.floor(h01(s, dayIdx, 10 + k) * starts.length)]
    const en = st + 45 + Math.floor(h01(s, dayIdx, 20 + k) * 2) * 15
    const lo = wfh ? hm(8) : arrive + 20
    const hi = wfh ? hm(17) : leave - 20
    if (st < lo || en > hi) continue
    if (items.some((i) => st < i.end && en > i.start)) continue
    items.push({ type: 'meeting', start: st, end: en })
  }
  items.sort((a, b) => a.start - b.start)
  const lo = wfh ? hm(8, 30) : arrive + 10
  const hi = wfh ? hm(17) : leave
  const all = []
  let cur = lo
  for (const it of items) {
    if (it.start - cur >= 40) all.push({ type: 'fokus', start: cur, end: it.start })
    all.push(it)
    cur = Math.max(cur, it.end)
  }
  if (hi - cur >= 40) all.push({ type: 'fokus', start: cur, end: hi })
  return { arrive, leave, items: all }
}

function toEvents(w, d, wfh) {
  const ev = []
  if (!wfh) ev.push(makeEvent('berangkat', Math.max(30, d.arrive - w.commute)))
  d.items.forEach((i) => ev.push({ ...makeEvent(i.type, i.start, i.end), seat: i.seat }))
  if (!wfh) ev.push(makeEvent('pulang', d.leave))
  return { mode: wfh ? 'wfh' : 'kantor', events: ev }
}

export function buildCrew({ roster, dayId, userModel, userLook, userName = 'Kamu', userDesk = USER_DESK, travelFor }) {
  const dayIdx = Math.max(0, DAYS.findIndex((d) => d.id === dayId))
  const wfhCount = 2 + (dayIdx % 2)
  const npcIdx = roster.map((w, i) => i).filter((i) => !roster[i].custom)
  const wfhSet = new Set(Array.from({ length: wfhCount }, (_, k) => npcIdx[(dayIdx * 3 + k * 5) % npcIdx.length]))
  const days = roster.map((w, i) => {
    if (w.custom) return { ...w.days[dayId], __custom: true }
    const wfh = wfhSet.has(i)
    return toEvents(w, npcDay(w, dayIdx, wfh), wfh)
  })

  const userMeet = userModel.wfh ? [] : userModel.items.filter((it) => it.type === 'meeting')
  const seatUse = new Map()
  userMeet.forEach((m, mi) => {
    seatUse.set(`${m.start}-${m.end}`, 1)
    const want = 3 + Math.floor(h01(m.start, mi, 99) * 3)
    const cands = roster
      .map((w, i) => ({ w, i }))
      .filter(({ w, i }) => !w.custom && days[i].mode !== 'wfh')
      .filter(({ i }) => {
        const evs = days[i].events
        const arr = evs.find((e) => e.type === 'berangkat')
        const lv = evs.find((e) => e.type === 'pulang')
        return arr && lv && arr.start + 40 < m.start - 10 && lv.start > m.end + 5
      })
    for (let k = 0; k < Math.min(want, cands.length); k++) {
      const pick = cands[(Math.floor(m.start / 15) + k * 3) % cands.length]
      const d = days[pick.i]
      d.events = d.events.filter((e) => !(e.end != null && e.type !== 'berangkat' && e.start < m.end && e.end > m.start))
      d.events.push({ ...makeEvent('meeting', m.start, m.end), seat: (k + 1) % 8 })
    }
    m.seat = 0
  })
  const CAP = 10
  const all = []
  days.forEach((d, di) => d.events.filter((e) => e.type === 'meeting').forEach((e) => all.push({ d, e, mine: userMeet.some((m) => m.start === e.start && m.end === e.end) })))
  all.sort((a, b) => Number(b.mine) - Number(a.mine) || a.e.start - b.e.start)
  const accepted = []
  const load = (t) => accepted.filter((x) => t >= x.e.start && t < x.e.end).length
  for (const x of all) {
    let ok = true
    for (let t = x.e.start; t < x.e.end; t += 15) if (load(t) >= CAP - 1) { ok = false; break }
    if (ok || x.mine) accepted.push(x)
    else x.d.events = x.d.events.filter((ev) => ev !== x.e)
  }
  days.forEach((d) => {
    d.events.forEach((e) => {
      if (e.type !== 'meeting' || e.seat != null) return
      const key = `${e.start}-${e.end}`
      const n = seatUse.get(key) ?? 0
      e.seat = n % 8
      seatUse.set(key, n + 1)
    })
  })

  const crew = [
    { id: 'me', name: userName, role: 'Kamu', base: 'male_shirt', look: userLook, desk: userDesk, pair: 0, pairIdx: 0, seed: 1, isMe: true, model: userModel, color: userLook.shirt },
  ]
  roster.forEach((w, i) => {
    const day = days[i]
    const model = buildDay(day, travelFor(w))
    crew.push({ ...w, model, color: w.look?.shirt || w.color || '#94a3b8' })
  })
  return crew
}

export const defaultTravelFor = (w) => makeTravel(null, w.commute)
