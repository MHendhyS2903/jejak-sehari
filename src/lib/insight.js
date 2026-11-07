import { DAYS, fmtDur, fmtHours, fmtTime } from './time.js'
import { TYPE_META } from './schedule.js'
import { buildDay } from './timeline.js'

const clip = (i, a, b) => Math.max(0, Math.min(i.end, b) - Math.max(i.start, a))

export function dayStats(model) {
  const lo = model.wfh ? (model.items[0]?.start ?? 0) : model.arrive
  const hi = model.wfh ? Math.max(0, ...model.items.map((i) => i.end)) : model.leave
  const sum = (t) => model.items.filter((i) => i.type === t).reduce((s, i) => s + clip(i, lo, hi), 0)
  const road = model.wfh ? 0 : model.out.minutes + model.back.minutes
  const meeting = sum('meeting')
  const istirahat = sum('istirahat')
  const fokus = sum('fokus')
  const span = Math.max(0, hi - lo)
  const lain = Math.max(0, span - meeting - istirahat - fokus)
  return { road, meeting, istirahat, fokus, lain, span }
}

export function dayWarnings(model) {
  const w = []
  const { items } = model
  if (!items.length) return w
  const sorted = [...items].sort((a, b) => a.start - b.start)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      w.push({ level: 'bad', text: `${TYPE_META[sorted[i].type].label} ${fmtTime(sorted[i].start)} bertabrakan dengan ${TYPE_META[sorted[i - 1].type].label.toLowerCase()} sebelumnya.` })
    }
  }
  if (!model.wfh) {
    const first = sorted[0]
    const gap = first.start - model.arrive
    if (gap < 0) {
      w.push({ level: 'bad', text: `${TYPE_META[first.type].label} ${fmtTime(first.start)} bentrok dengan estimasi tiba ${fmtTime(model.arrive)}.` })
    } else if (gap < 15) {
      w.push({ level: 'warn', text: `Hanya ${Math.round(gap)} menit antara estimasi tiba (${fmtTime(model.arrive)}) dan ${TYPE_META[first.type].label.toLowerCase()} pertama ${fmtTime(first.start)}.` })
    }
    const lastEnd = Math.max(...sorted.map((i) => i.end))
    if (model.leave < lastEnd) {
      w.push({ level: 'warn', text: `Pulang ${fmtTime(model.leave)} lebih awal dari agenda terakhir yang selesai ${fmtTime(lastEnd)}.` })
    }
  }
  const st = dayStats(model)
  if (st.fokus < 120) {
    w.push({ level: 'warn', text: `Jam kerja fokus hanya ${fmtDur(st.fokus)} (kurang dari 2 jam).` })
  }
  return w
}

export function departAdvice(day, model, travel) {
  if (day.mode === 'wfh') {
    return { status: 'wfh', text: 'Hari WFH: tidak ada perjalanan, jadi tidak perlu berangkat.' }
  }
  const first = model.items[0]
  if (!first) return null
  const BUF = 15
  let latest = 0
  let mins = travel(0).minutes
  for (let d = Math.floor(first.start - BUF); d >= 0; d--) {
    const t = travel(d).minutes
    if (d + t + BUF <= first.start) { latest = d; mins = t; break }
  }
  const name = first.type === 'meeting' ? 'Meeting pertama' : 'Agenda pertama'
  const text = `${name} ${fmtTime(first.start)}, perjalanan ±${Math.round(mins)} menit, berangkat paling lambat ${fmtTime(latest)} (sudah termasuk buffer ${BUF} menit).`
  const diff = latest - model.depart
  let note
  let status
  if (diff >= 0) {
    status = 'ok'
    note = diff < 5 ? `Berangkat ${fmtTime(model.depart)} pas batas waktu.` : `Berangkat ${fmtTime(model.depart)} aman, ${fmtDur(diff)} lebih awal dari batas.`
  } else {
    status = 'late'
    note = `Berangkat ${fmtTime(model.depart)} terlalu mepet. Majukan sekitar ${fmtDur(-diff)}.`
  }
  return { status, text, note, latest }
}

export function weekly(schedule, travel) {
  const rows = DAYS.map((d) => {
    const model = buildDay(schedule.days[d.id], travel)
    const st = dayStats(model)
    return { ...d, wfh: model.wfh, ...st, busy: st.road + st.meeting }
  })
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0)
  const road = sum('road')
  const meeting = sum('meeting')
  const fokus = sum('fokus')
  const busiest = rows.reduce((a, b) => (b.busy > a.busy ? b : a), rows[0])
  const lines = []
  lines.push(`Minggu ini kamu menghabiskan ${fmtHours(road)} di jalan dan ${fmtHours(meeting)} di meeting, dengan ${fmtHours(fokus)} kerja fokus.`)
  const officeDays = rows.filter((r) => !r.wfh && r.road > 0)
  const wfhDays = rows.filter((r) => r.wfh)
  if (wfhDays.length && officeDays.length) {
    const avg = officeDays.reduce((s, r) => s + r.road, 0) / officeDays.length
    lines.push(`${busiest.label} paling padat. WFH ${wfhDays.map((r) => r.label).join(' & ')} menghemat sekitar ${fmtDur(avg * wfhDays.length)} perjalanan.`)
  } else if (fokus > 0 && road > fokus * 0.5) {
    lines.push(`${busiest.label} paling padat. Waktu di jalan setara ${Math.round((road / fokus) * 100)}% jam fokusmu, coba berangkat lebih pagi atau jadwalkan WFH.`)
  } else {
    lines.push(`${busiest.label} paling padat (${fmtHours(busiest.busy)} di jalan + meeting).`)
  }
  return { rows, road, meeting, fokus, busiest, lines }
}
