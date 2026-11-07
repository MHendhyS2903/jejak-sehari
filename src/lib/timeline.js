import { clamp } from './time.js'
import { MIDDLE, TYPE_META, sortEvents } from './schedule.js'

const IDLE = 1.6
const DRIVE = 6.5
const ENTER = 3.4
const EXIT_IN = 6.0
const EXIT_OUT = 3.0
const MIN_ITEM = 2.2
export const ENTER_MIN = 5
export const EXIT_IN_MIN = 3
export const EXIT_OUT_MIN = 3
const FADE_IN = 0.9
const FADE_OUT = 0.5

const easeIO = (f) => 0.5 - 0.5 * Math.cos(Math.PI * f)

export function buildDay(day, travel) {
  const wfh = day.mode === 'wfh'
  const evs = sortEvents(day.events)
  const items = evs
    .filter((e) => MIDDLE.includes(e.type))
    .map((e) => ({ ...e, end: Math.max(e.end ?? e.start + 1, e.start + 1) }))

  let depart = null, arrive = null, leave = null, arriveHome = null, out = null, back = null, inStart = null
  let t0, t1
  const iv = []
  const add = (kind, m0, m1, sec, extra = {}) => {
    if (m1 - m0 > 0.01) iv.push({ kind, m0, m1, sec, ...extra })
  }
  const officeSplit = (a, b, share) => {
    const pts = new Set([a, b])
    items.forEach((i) => {
      pts.add(clamp(i.start, a, b))
      pts.add(clamp(i.end, a, b))
    })
    const sorted = [...pts].sort((x, y) => x - y)
    const n = sorted.length - 1
    const total = Math.max(share, n * MIN_ITEM)
    const ws = []
    for (let i = 1; i < sorted.length; i++) ws.push(Math.sqrt(sorted[i] - sorted[i - 1]))
    const sw = ws.reduce((s, w) => s + w, 0) || 1
    const extra = total - n * MIN_ITEM
    for (let i = 1; i < sorted.length; i++) {
      const sec = MIN_ITEM + (extra * ws[i - 1]) / sw
      add('office', sorted[i - 1], sorted[i], i === 1 ? Math.max(sec, 6.5) : sec, { first: i === 1 })
    }
  }

  if (!wfh) {
    const b = evs.find((e) => e.type === 'berangkat')
    const p = [...evs].reverse().find((e) => e.type === 'pulang')
    depart = clamp(b ? b.start : items[0] ? items[0].start - 90 : 420, 30, 1320)
    out = travel(depart)
    arrive = depart + out.minutes
    inStart = arrive + ENTER_MIN
    const lastEnd = items.length ? Math.max(...items.map((i) => i.end)) : inStart + 60
    leave = Math.max(p ? p.start : lastEnd, inStart + 10)
    back = travel(leave)
    arriveHome = leave + EXIT_IN_MIN + EXIT_OUT_MIN + back.minutes
    t0 = Math.max(0, depart - 40)
    t1 = Math.min(1439, arriveHome + 40)

    add('pre', t0, depart, 4.4)
    add('out', depart, arrive, DRIVE)
    add('enter', arrive, inStart, ENTER)
    officeSplit(inStart, leave, 20)
    add('exitin', leave, leave + EXIT_IN_MIN, EXIT_IN)
    add('exitout', leave + EXIT_IN_MIN, leave + EXIT_IN_MIN + EXIT_OUT_MIN, EXIT_OUT)
    add('back', leave + EXIT_IN_MIN + EXIT_OUT_MIN, arriveHome, DRIVE)
    add('post', arriveHome, t1, IDLE)
  } else {
    const first = items.length ? items[0].start : 480
    const last = items.length ? Math.max(...items.map((i) => i.end)) : 1020
    t0 = Math.max(0, first - 45)
    t1 = Math.min(1439, last + 45)
    add('pre', t0, first, IDLE)
    officeSplit(first, last, 22)
    add('post', last, t1, IDLE)
  }
  if (!iv.length) add('office', 480, 1020, 10)

  let acc = 0
  for (const v of iv) {
    v.s0 = acc
    v.s1 = acc + v.sec
    acc += v.sec
  }
  const total = acc

  const interior = (k) => k === 'office' || k === 'exitin'

  const find = (p) => {
    const s = clamp(p, 0, 1) * total
    let i = 0
    while (i < iv.length - 1 && s >= iv[i].s1) i++
    const v = iv[i]
    return { v, i, s, f: clamp((s - v.s0) / (v.s1 - v.s0 || 1), 0, 1) }
  }

  const progressAtMinute = (m) => {
    const v = iv.find((x) => m >= x.m0 && m <= x.m1) || (m < iv[0].m0 ? iv[0] : iv[iv.length - 1])
    const f = clamp((m - v.m0) / (v.m1 - v.m0 || 1), 0, 1)
    return (v.s0 + f * (v.s1 - v.s0)) / total
  }

  const stateAt = (p) => {
    const { v, i, s, f } = find(p)
    const minute = v.m0 + f * (v.m1 - v.m0)
    let path = 'out'
    let u = 0
    if (!wfh) {
      if (v.kind === 'pre') { path = 'out'; u = 0 }
      else if (v.kind === 'out') { path = 'out'; u = easeIO(f) }
      else if (v.kind === 'enter' || v.kind === 'office' || v.kind === 'exitin' || v.kind === 'exitout') { path = 'out'; u = 1 }
      else if (v.kind === 'back') { path = 'back'; u = easeIO(f) }
      else { path = 'back'; u = 1 }
    }
    let active = -1
    for (let k = 0; k < items.length; k++) {
      if (minute >= items[k].start && minute < items[k].end) { active = k; break }
    }
    let fade = 0
    if (v.kind === 'enter') fade = clamp(1 - (v.s1 - s) / FADE_IN, 0, 1)
    else if (v.kind === 'office' && v.first && !wfh) fade = clamp(1 - (s - v.s0) / FADE_OUT, 0, 1)
    else if (v.kind === 'exitin') fade = clamp(1 - (v.s1 - s) / FADE_IN, 0, 1)
    else if (v.kind === 'exitout') fade = clamp(1 - (s - v.s0) / FADE_OUT, 0, 1)
    return {
      minute, phase: wfh ? 'home' : v.kind, kind: v.kind, path, u, f, fade, index: i,
      scene: wfh ? 'home' : interior(v.kind) ? 'interior' : 'city',
      driving: !wfh && (v.kind === 'out' || v.kind === 'back'),
      active,
      atOffice: !wfh && (v.kind === 'enter' || v.kind === 'office' || v.kind === 'exitin' || v.kind === 'exitout'),
      doneCount: items.filter((it) => minute >= it.end).length,
    }
  }

  const rateAt = (m) => {
    const v = iv.find((x) => m >= x.m0 && m < x.m1) || (m < iv[0].m0 ? iv[0] : iv[iv.length - 1])
    return Math.max(0.2, (v.m1 - v.m0) / (v.s1 - v.s0 || 1))
  }

  const markers = []
  if (!wfh) markers.push({ id: 'dep', type: 'berangkat', m: depart, p: progressAtMinute(depart) })
  items.forEach((i) => markers.push({ id: i.id, type: i.type, m: i.start, p: progressAtMinute(i.start) }))
  if (!wfh) markers.push({ id: 'lv', type: 'pulang', m: leave, p: progressAtMinute(leave) })

  return {
    wfh, items, depart, arrive, inStart, leave, arriveHome, out, back, t0, t1, total, markers,
    stateAt, progressAtMinute, rateAt, intervals: iv, labelOf: (t) => TYPE_META[t].label,
  }
}

export function linearTimeline(t0 = 390, t1 = 1170, total = 60) {
  const progressAtMinute = (m) => clamp((m - t0) / (t1 - t0), 0, 1)
  return {
    t0, t1, total, markers: [], items: [], wfh: false, linear: true,
    progressAtMinute,
    rateAt: () => (t1 - t0) / total,
    stateAt: (p) => ({
      minute: t0 + clamp(p, 0, 1) * (t1 - t0), kind: 'office', phase: 'office', scene: 'interior',
      fade: 0, active: -1, driving: false, path: 'out', u: 1, f: 0, atOffice: true,
    }),
  }
}
