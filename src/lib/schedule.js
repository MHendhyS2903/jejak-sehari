import { DAYS } from './time.js'

let counter = 0
export const uid = () => `e${Date.now().toString(36)}${(counter++).toString(36)}`

export const MIDDLE = ['meeting', 'istirahat', 'fokus']

export const TYPE_META = {
  berangkat: { label: 'Berangkat', color: '#f472b6' },
  meeting: { label: 'Meeting', color: '#a78bfa' },
  istirahat: { label: 'Istirahat', color: '#fbbf24' },
  fokus: { label: 'Kerja fokus', color: '#22d3ee' },
  pulang: { label: 'Pulang', color: '#fb7185' },
}

export const TYPES = Object.keys(TYPE_META)
export const isRange = (type) => MIDDLE.includes(type)

export const DEFAULT_LEN = { meeting: 60, istirahat: 60, fokus: 90 }

export function makeEvent(type, start, end) {
  const e = { id: uid(), type, start }
  if (isRange(type)) e.end = end ?? Math.min(1439, start + DEFAULT_LEN[type])
  return e
}

export function sortEvents(events) {
  return [...events].sort((a, b) => a.start - b.start)
}

export function validateEvents(events, mode) {
  const errors = {}
  const mid = sortEvents(events.filter((e) => isRange(e.type)))
  for (const e of mid) {
    if (e.end <= e.start) errors[e.id] = 'Jam selesai harus setelah jam mulai'
  }
  for (let i = 1; i < mid.length; i++) {
    if (mid[i].start < mid[i - 1].end && !errors[mid[i].id]) {
      errors[mid[i].id] = `Bertabrakan dengan ${TYPE_META[mid[i - 1].type].label.toLowerCase()}`
    }
  }
  if (mode !== 'wfh') {
    for (const t of ['berangkat', 'pulang']) {
      const list = events.filter((e) => e.type === t)
      list.slice(1).forEach((e) => {
        errors[e.id] = `Hanya boleh satu "${TYPE_META[t].label.toLowerCase()}"`
      })
    }
    const b = events.find((e) => e.type === 'berangkat')
    const p = events.find((e) => e.type === 'pulang')
    if (b && p && p.start <= b.start) errors[p.id] = 'Pulang harus setelah berangkat'
  }
  return errors
}

export function reorderMiddle(events, fromId, toId) {
  const mid = sortEvents(events.filter((e) => isRange(e.type)))
  const from = mid.findIndex((e) => e.id === fromId)
  const to = mid.findIndex((e) => e.id === toId)
  if (from < 0 || to < 0 || from === to) return events
  const order = [...mid]
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved)
  const slots = mid.map((e) => e.start)
  const next = new Map()
  order.forEach((e, i) => {
    const len = Math.max(15, e.end - e.start)
    const start = slots[i]
    next.set(e.id, { ...e, start, end: Math.min(1439, start + len) })
  })
  return events.map((e) => next.get(e.id) ?? e)
}

export function cloneEvents(events) {
  return events.map((e) => ({ ...e, id: uid() }))
}

export function emptyDays() {
  return Object.fromEntries(DAYS.map((d) => [d.id, { mode: 'kantor', events: [] }]))
}

export function normalizeSchedule(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Format file tidak dikenali')
  const loc = (l, fallbackLabel) => {
    if (!l || !Number.isFinite(+l.lat) || !Number.isFinite(+l.lng)) throw new Error('Lokasi tidak valid')
    return {
      presetId: typeof l.presetId === 'string' ? l.presetId : 'manual',
      lat: +l.lat,
      lng: +l.lng,
      label: String(l.label ?? fallbackLabel).slice(0, 80),
    }
  }
  const days = emptyDays()
  for (const d of DAYS) {
    const src = raw.days?.[d.id]
    if (!src) continue
    days[d.id] = {
      mode: src.mode === 'wfh' ? 'wfh' : 'kantor',
      events: (Array.isArray(src.events) ? src.events : [])
        .filter((e) => TYPES.includes(e?.type) && Number.isFinite(+e.start))
        .map((e) => {
          const start = Math.min(1439, Math.max(0, Math.round(+e.start)))
          return isRange(e.type)
            ? { id: uid(), type: e.type, start, end: Math.min(1439, Math.max(start + 1, Math.round(+e.end || start + 60))) }
            : { id: uid(), type: e.type, start }
        }),
    }
  }
  return {
    version: 1,
    custom: true,
    home: loc(raw.home, 'Rumah'),
    office: loc(raw.office, 'Kantor'),
    manualMinutes: Number.isFinite(+raw.manualMinutes) && +raw.manualMinutes > 0 ? Math.round(+raw.manualMinutes) : null,
    accent: ['cyan', 'violet', 'pink', 'lime'].includes(raw.accent) ? raw.accent : 'cyan',
    activeDay: DAYS.some((d) => d.id === raw.activeDay) ? raw.activeDay : 'sen',
    days,
  }
}
