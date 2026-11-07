export const DAYS = [
  { id: 'sen', label: 'Senin', short: 'Sen' },
  { id: 'sel', label: 'Selasa', short: 'Sel' },
  { id: 'rab', label: 'Rabu', short: 'Rab' },
  { id: 'kam', label: 'Kamis', short: 'Kam' },
  { id: 'jum', label: 'Jumat', short: 'Jum' },
]

const p2 = (n) => String(n).padStart(2, '0')

export function fmtTime(m, sep = '.') {
  const t = ((Math.round(m) % 1440) + 1440) % 1440
  return p2(Math.floor(t / 60)) + sep + p2(t % 60)
}

export const toInput = (m) => fmtTime(m, ':')

export function parseInput(s) {
  const [h, m] = String(s).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

export function fmtDur(min) {
  min = Math.round(min)
  if (min < 60) return `${min} mnt`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} j ${m} m` : `${h} j`
}

export function fmtHours(min) {
  return `${(min / 60).toFixed(1).replace('.', ',')} jam`
}

export function trafficFactor(m) {
  const t = ((m % 1440) + 1440) % 1440
  if ((t >= 390 && t <= 570) || (t >= 960 && t <= 1170)) return 1.8
  return 1.2
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
