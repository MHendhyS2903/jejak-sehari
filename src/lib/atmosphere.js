import { clamp, smooth } from './time.js'
import { h01 } from './hash.js'

export function jamAt(minute) {
  const m = ((minute % 1440) + 1440) % 1440
  const bump = (a, b) => smooth(a - 40, a + 25, m) * (1 - smooth(b - 25, b + 40, m))
  return clamp(Math.max(bump(390, 570), bump(960, 1170)), 0, 1)
}

export function densityAt(minute, rain = 0) {
  const m = ((minute % 1440) + 1440) % 1440
  const jam = jamAt(m)
  const night = m < 300 || m > 1320 ? 0.35 : 1
  return clamp((0.3 + 0.7 * jam + rain * 0.2) * night, 0.15, 1)
}

export const WEATHER_MODES = [
  { id: 'cerah', label: 'Cerah' },
  { id: 'hujan', label: 'Hujan sore' },
  { id: 'acak', label: 'Acak' },
]

export function weatherAt(minute, mode, dayId = 'sen') {
  const m = ((minute % 1440) + 1440) % 1440
  let start = 930
  let end = 1110
  let on = mode === 'hujan'
  if (mode === 'acak') {
    const seed = [...dayId].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7)
    on = h01(seed, 11) < 0.55
    start = 840 + Math.floor(h01(seed, 12) * 150)
    end = start + 80 + Math.floor(h01(seed, 13) * 100)
  }
  const rain = on ? clamp(smooth(start - 25, start + 15, m) * (1 - smooth(end - 20, end + 30, m)), 0, 1) : 0
  const base = 26 + 7 * Math.sin(clamp((m - 330) / 840, 0, 1) * Math.PI)
  const temp = Math.round(base - rain * 4)
  const cloud = clamp(0.45 + rain * 0.5 + (m > 900 && m < 1080 ? 0.2 : 0), 0, 1)
  let label
  if (rain > 0.5) label = 'Hujan deras'
  else if (rain > 0.1) label = 'Hujan ringan'
  else if (m < 360 || m > 1110) label = m > 1110 ? 'Malam berawan' : 'Berkabut tipis'
  else if (m < 480) label = 'Berkabut pagi'
  else if (m > 960) label = 'Berawan sore'
  else label = 'Cerah berawan'
  return { rain, temp, cloud, label }
}
