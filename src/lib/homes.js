import { haversineKm } from './estimate.js'
import { hashStr } from './hash.js'

export const HOMES = [
  { name: 'Kebon Jeruk, Jakarta Barat', lat: -6.1925, lng: 106.7692 },
  { name: 'Kembangan, Jakarta Barat', lat: -6.1883, lng: 106.739 },
  { name: 'Grogol, Jakarta Barat', lat: -6.1672, lng: 106.7897 },
  { name: 'Cipondoh, Tangerang', lat: -6.204, lng: 106.6892 },
  { name: 'Karawaci, Tangerang', lat: -6.2255, lng: 106.6086 },
  { name: 'Menteng, Jakarta Pusat', lat: -6.1962, lng: 106.8294 },
  { name: 'Kelapa Gading, Jakarta Utara', lat: -6.1572, lng: 106.9066 },
  { name: 'Tebet, Jakarta Selatan', lat: -6.226, lng: 106.8545 },
  { name: 'Pondok Indah, Jakarta Selatan', lat: -6.2656, lng: 106.7835 },
  { name: 'Cibubur, Jakarta Timur', lat: -6.3706, lng: 106.8943 },
  { name: 'Pondok Gede, Bekasi', lat: -6.2593, lng: 106.9261 },
  { name: 'Bekasi Selatan', lat: -6.2706, lng: 106.9822 },
  { name: 'Margonda, Depok', lat: -6.3688, lng: 106.833 },
  { name: 'BSD City, Tangerang Selatan', lat: -6.3012, lng: 106.652 },
  { name: 'Cengkareng, Jakarta Barat', lat: -6.1488, lng: 106.7351 },
  { name: 'Bogor Tengah, Bogor', lat: -6.5944, lng: 106.7892 },
]

const OFFICE_REF = { lat: -6.1517, lng: 106.7306 }

export function homeAt(key) {
  const i = typeof key === 'number' ? key : hashStr(String(key))
  const h = HOMES[((i % HOMES.length) + HOMES.length) % HOMES.length]
  return { presetId: 'manual', lat: h.lat, lng: h.lng, label: `Rumah, ${h.name}` }
}

export function commuteFor(home) {
  const km = haversineKm(home, OFFICE_REF) * 1.35
  return Math.max(15, Math.min(95, Math.round((km / 24) * 60)))
}

export function variantFor(home, seed = 0) {
  const km = haversineKm(home, OFFICE_REF)
  const pools = km < 7 ? [4, 5] : km < 14 ? [2, 3] : km < 26 ? [1, 2, 3] : [6, 7]
  return pools[Math.abs(seed) % pools.length]
}
