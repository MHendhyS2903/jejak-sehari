import { fmtDur, fmtTime } from './time.js'
import { TYPE_META } from './schedule.js'

export const SLICES = [
  { key: 'road', label: 'Di jalan', color: '#f472b6' },
  { key: 'meeting', label: 'Meeting', color: '#a78bfa' },
  { key: 'istirahat', label: 'Istirahat', color: '#fbbf24' },
  { key: 'fokus', label: 'Kerja fokus', color: '#22d3ee' },
  { key: 'lain', label: 'Lainnya', color: '#64748b' },
]

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif'

function rr(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

export async function drawShareCard(canvas, { dayLabel, wfh, stats, model, advice, homeLabel, officeLabel }) {
  try {
    await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`500 28px ${FONT}`)])
  } catch {
  }
  const W = 1080
  const H = 1350
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')

  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0a1030')
  bg.addColorStop(0.55, '#150f3d')
  bg.addColorStop(1, '#2a1250')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  const glow = (x, y, r, c) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, c)
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, W, H)
  }
  glow(900, 140, 520, 'rgba(34,211,238,0.28)')
  glow(120, 1200, 560, 'rgba(167,139,250,0.28)')

  g.fillStyle = '#e8ecff'
  g.font = `800 64px ${FONT}`
  g.fillText('Jejak Sehari', 72, 125)
  g.fillStyle = '#8f9bd0'
  g.font = `500 28px ${FONT}`
  g.fillText('Lihat ke mana harimu pergi', 72, 170)

  g.fillStyle = 'rgba(255,255,255,0.07)'
  rr(g, 72, 215, W - 144, 110, 28)
  g.fill()
  g.fillStyle = '#e8ecff'
  g.font = `700 44px ${FONT}`
  g.fillText(`${dayLabel}${wfh ? ' · WFH' : ''}`, 108, 285)
  g.fillStyle = '#8f9bd0'
  g.font = `500 24px ${FONT}`
  const route = wfh ? homeLabel : `${homeLabel}  →  ${officeLabel}`
  g.fillText(route.length > 62 ? route.slice(0, 61) + '…' : route, 108, 315)

  const cx = 320
  const cy = 640
  const R = 190
  const total = SLICES.reduce((s, x) => s + (stats[x.key] || 0), 0) || 1
  let a = -Math.PI / 2
  g.lineWidth = 62
  g.lineCap = 'butt'
  g.strokeStyle = 'rgba(255,255,255,0.06)'
  g.beginPath()
  g.arc(cx, cy, R, 0, Math.PI * 2)
  g.stroke()
  for (const s of SLICES) {
    const v = stats[s.key] || 0
    if (!v) continue
    const da = (v / total) * Math.PI * 2
    g.strokeStyle = s.color
    g.beginPath()
    g.arc(cx, cy, R, a + 0.012, a + da - 0.012)
    g.stroke()
    a += da
  }
  g.fillStyle = '#e8ecff'
  g.textAlign = 'center'
  g.font = `800 62px ${FONT}`
  g.fillText(`${(total / 60).toFixed(1).replace('.', ',')}`, cx, cy + 14)
  g.fillStyle = '#8f9bd0'
  g.font = `500 26px ${FONT}`
  g.fillText('jam tercatat', cx, cy + 54)
  g.textAlign = 'left'

  let y = 500
  for (const s of SLICES) {
    const v = stats[s.key] || 0
    g.fillStyle = s.color
    rr(g, 580, y - 26, 30, 30, 9)
    g.fill()
    g.fillStyle = '#e8ecff'
    g.font = `600 32px ${FONT}`
    g.fillText(s.label, 628, y)
    g.fillStyle = '#aab4e6'
    g.font = `500 28px ${FONT}`
    g.textAlign = 'right'
    g.fillText(fmtDur(v), W - 72, y)
    g.textAlign = 'left'
    y += 70
  }

  const t0 = model.t0
  const t1 = model.t1
  const bx = 72
  const bw = W - 144
  const by = 920
  g.fillStyle = 'rgba(255,255,255,0.07)'
  rr(g, bx, by, bw, 26, 13)
  g.fill()
  const px = (m) => bx + ((m - t0) / (t1 - t0)) * bw
  for (const it of model.items) {
    g.fillStyle = TYPE_META[it.type].color
    const x0 = px(it.start)
    rr(g, x0, by, Math.max(6, px(it.end) - x0), 26, 8)
    g.fill()
  }
  if (!model.wfh) {
    g.fillStyle = '#f472b6'
    g.fillRect(px(model.depart) - 3, by - 8, 6, 42)
    g.fillRect(px(model.leave) - 3, by - 8, 6, 42)
  }
  g.fillStyle = '#8f9bd0'
  g.font = `500 24px ${FONT}`
  g.fillText(fmtTime(t0), bx, by + 66)
  g.textAlign = 'right'
  g.fillText(fmtTime(t1), bx + bw, by + 66)
  g.textAlign = 'left'

  if (advice?.text) {
    g.fillStyle = 'rgba(34,211,238,0.12)'
    rr(g, 72, 1030, W - 144, 190, 28)
    g.fill()
    g.fillStyle = '#67e8f9'
    g.font = `700 24px ${FONT}`
    g.fillText('REKOMENDASI BERANGKAT', 108, 1080)
    g.fillStyle = '#e8ecff'
    g.font = `500 27px ${FONT}`
    wrap(g, advice.text, 108, 1124, W - 216, 38, 3)
  }
  g.fillStyle = '#6b77aa'
  g.font = `500 24px ${FONT}`
  g.fillText('Estimasi perjalanan, bukan rute peta asli', 72, 1290)
}

function wrap(g, text, x, y, maxW, lh, maxLines) {
  const words = text.split(' ')
  let line = ''
  let n = 0
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y)
      y += lh
      line = w
      if (++n >= maxLines) return
    } else line = test
  }
  if (line) g.fillText(line, x, y)
}
