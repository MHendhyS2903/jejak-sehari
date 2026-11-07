import * as THREE from 'three'
import { clamp, smooth } from '../../lib/time.js'

export const nightU = { value: 0 }

const KF = [
  [0, '#0a0e2c', '#27264f'],
  [270, '#141c45', '#3a3866'],
  [330, '#2b3a78', '#e08f78'],
  [390, '#7d98bf', '#dccfc0'],
  [480, '#86a6c9', '#d9dcd8'],
  [720, '#9bb6d2', '#efe9df'],
  [930, '#8fa6c0', '#ead5b6'],
  [1020, '#8c7fa5', '#f3a870'],
  [1080, '#6b5a9c', '#f27c70'],
  [1125, '#413675', '#a85b86'],
  [1200, '#171b48', '#3b3568'],
  [1320, '#0b0f2e', '#272a58'],
  [1440, '#0a0e2c', '#27264f'],
].map(([m, z, h]) => [m, new THREE.Color(z), new THREE.Color(h)])

export function skyColors(minute, zenith, horizon) {
  const m = ((minute % 1440) + 1440) % 1440
  let i = 0
  while (i < KF.length - 2 && m >= KF[i + 1][0]) i++
  const a = KF[i]
  const b = KF[i + 1]
  const f = clamp((m - a[0]) / (b[0] - a[0]), 0, 1)
  zenith.copy(a[1]).lerp(b[1], f)
  horizon.copy(a[2]).lerp(b[2], f)
}

const SUNRISE = 345
const DAYLEN = 735

export function sunInfo(minute, outDir) {
  const ang = ((minute - SUNRISE) / DAYLEN) * Math.PI
  const sinElev = Math.sin(ang)
  outDir.set(Math.cos(ang), Math.max(0.05, sinElev), 0.45).normalize()
  return { sinElev, night: clamp((0.14 - sinElev) / 0.3, 0, 1), day: smooth(0.0, 0.35, sinElev) }
}

let glowTex
export function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c)
  glowTex.colorSpace = THREE.SRGBColorSpace
  return glowTex
}

export const accentColor = (a) => ACCENTS[a] || (typeof a === 'string' && a[0] === '#' ? a : ACCENTS.cyan)
export const ACCENTS = {
  cyan: '#22d3ee',
  violet: '#a78bfa',
  pink: '#f472b6',
  lime: '#a3e635',
}
