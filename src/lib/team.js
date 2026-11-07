import { DAYS } from './time.js'
import { normalizeSchedule, uid } from './schedule.js'
import { load, save } from './storage.js'
import { h01, hashStr } from './hash.js'
import { BASES } from './roster.js'
import { HAIRS, PANTS, SHIRTS, SKINS } from './recolor.js'

const KEY = 'team'
export function loadTeam() {
  const raw = load(KEY)
  if (Array.isArray(raw)) {
    try {
      return raw.filter((w) => w && w.custom && w.base && w.look).map((w) => ({ ...w, days: normalizeSchedule({ home: { lat: 0, lng: 0 }, office: { lat: 0, lng: 0 }, days: w.days }).days }))
    } catch {
    }
  }
  return []
}
export const saveTeam = (t) => save(KEY, t)

const COLORS = ['#f472b6', '#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#f97316', '#e879f9']

export function sharePayload(p) {
  const slim = { name: p.name, role: p.role, commute: p.commute, days: {} }
  for (const d of DAYS) {
    slim.days[d.id] = { mode: p.days[d.id].mode, events: p.days[d.id].events.map(({ type, start, end }) => (end == null ? { type, start } : { type, start, end })) }
  }
  return slim
}

export function encodeShare(p) {
  return 'JS1:' + btoa(unescape(encodeURIComponent(JSON.stringify(sharePayload(p)))))
}

export function decodeShare(text, colorIndex = 0) {
  let t = String(text).trim()
  if (!t) throw new Error('Kode kosong')
  if (t.startsWith('JS1:')) t = decodeURIComponent(escape(atob(t.slice(4))))
  let raw
  try { raw = JSON.parse(t) } catch { throw new Error('Format kode/JSON tidak dikenali') }
  if (raw.days === undefined) throw new Error('Jadwal tidak ditemukan')
  const norm = normalizeSchedule({ home: { lat: 0, lng: 0 }, office: { lat: 0, lng: 0 }, days: raw.days })
  const id = uid()
  const seed = hashStr(id + colorIndex)
  const pick = (arr, k) => arr[Math.floor(h01(seed, k) * arr.length)]
  return {
    id,
    custom: true,
    seed,
    name: String(raw.name || 'Anggota').slice(0, 30),
    role: String(raw.role || 'Anggota tim').slice(0, 40),
    base: pick(BASES, 1),
    look: { shirt: COLORS[colorIndex % COLORS.length] || pick(SHIRTS, 2), pants: pick(PANTS, 3), hair: pick(HAIRS, 4), skin: pick(SKINS, 5) },
    commute: Math.max(5, Math.min(240, Math.round(+raw.commute || 40))),
    days: norm.days,
  }
}
