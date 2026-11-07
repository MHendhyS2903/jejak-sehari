import { fmtDur, fmtTime } from './time.js'
import { dayStats } from './insight.js'

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const sum = (a) => a.reduce((s, x) => s + x, 0)
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)

export function teamInsight(members) {
  const office = members.filter((m) => !m.model.wfh)
  const wfh = members.filter((m) => m.model.wfh)
  const step = 15
  const present = (m, t) => !m.model.wfh && t >= m.model.inStart && t < m.model.leave
  const inMeeting = (m, t) => m.model.items.some((i) => i.type === 'meeting' && t >= i.start && t < i.end)
  const onBreak = (m, t) => m.model.items.some((i) => i.type === 'istirahat' && t >= i.start && t < i.end)
  const onRoad = (m, t) => !m.model.wfh && ((t >= m.model.depart && t < m.model.arrive) || (t >= m.model.leave + 6 && t < m.model.arriveHome))

  let peak = { count: -1, at: 0 }
  let lunch = { count: -1, at: 0 }
  const slots = []
  let cur = null
  const head = []
  for (let t = 6 * 60; t < 20 * 60; t += step) {
    const c = members.filter((m) => inMeeting(m, t) && (m.model.wfh || present(m, t))).length
    if (c > peak.count) peak = { count: c, at: t }
    const b = members.filter((m) => onBreak(m, t)).length
    if (b > lunch.count) lunch = { count: b, at: t }
    const free = office.length > 0 && office.every((m) => present(m, t) && !inMeeting(m, t))
    if (free) {
      if (!cur) cur = { a: t, b: t + step }
      else cur.b = t + step
    } else if (cur) {
      slots.push(cur)
      cur = null
    }
    if ((t - 6 * 60) % 30 === 0) head.push({ t, office: office.filter((m) => present(m, t)).length, road: members.filter((m) => onRoad(m, t)).length })
  }
  if (cur) slots.push(cur)
  const good = slots.filter((s) => s.b - s.a >= 30).sort((x, y) => y.b - y.a - (x.b - x.a)).slice(0, 2)

  const rows = members.map((m) => ({ m, st: dayStats(m.model) }))
  const total = { road: 0, meeting: 0, istirahat: 0, fokus: 0, lain: 0 }
  rows.forEach(({ st }) => { Object.keys(total).forEach((k) => { total[k] += st[k] }) })
  const work = total.meeting + total.istirahat + total.fokus + total.lain

  const sessions = new Set()
  members.forEach((m) => m.model.items.filter((i) => i.type === 'meeting').forEach((i) => sessions.add(`${i.start}-${i.end}`)))
  const most = rows.length ? rows.reduce((a, b) => (b.st.meeting > a.st.meeting ? b : a)) : null
  const meetingRows = rows.filter((r) => r.st.meeting > 0)

  const commuters = rows.filter(({ m }) => !m.model.wfh)
  const oneWay = commuters.map(({ m }) => (m.model.out.minutes + m.model.back.minutes) / 2)
  const roundTrips = commuters.map(({ st }) => st.road)
  const longest = commuters.length ? commuters.reduce((a, b) => (b.st.road > a.st.road ? b : a)) : null
  const shortest = commuters.length ? commuters.reduce((a, b) => (b.st.road < a.st.road ? b : a)) : null
  const buckets = [
    { label: '< 30 mnt', n: oneWay.filter((x) => x < 30).length },
    { label: '30–60 mnt', n: oneWay.filter((x) => x >= 30 && x < 60).length },
    { label: '> 60 mnt', n: oneWay.filter((x) => x >= 60).length },
  ]
  const topBucket = commuters.length ? buckets.reduce((a, b) => (b.n > a.n ? b : a)) : null

  const lowFocus = rows.filter(({ st }) => st.fokus < 120).map(({ m, st }) => ({ name: m.name, fokus: st.fokus }))
  const heavyMeet = rows.filter(({ st }) => st.meeting >= 240).map(({ m, st }) => ({ name: m.name, meeting: st.meeting }))
  const longCommute = commuters.filter(({ st }) => st.road >= 150).map(({ m, st }) => ({ name: m.name, road: st.road }))
  const least = rows.length ? rows.reduce((a, b) => (b.st.fokus < a.st.fokus ? b : a)) : null
  const lunchLens = rows.map(({ m }) => sum(m.model.items.filter((i) => i.type === 'istirahat').map((i) => i.end - i.start))).filter((x) => x > 0)

  const arrivals = office.map((m) => m.model.arrive)
  const leaves = office.map((m) => m.model.leave)
  const earliest = office.length ? office.reduce((a, b) => (b.model.arrive < a.model.arrive ? b : a)) : null
  const latest = office.length ? office.reduce((a, b) => (b.model.leave > a.model.leave ? b : a)) : null

  const alerts = []
  if (peak.count >= 9) alerts.push({ level: 'warn', text: `Ruang meeting hampir penuh pada ${fmtTime(peak.at)}: ${peak.count} orang sekaligus (kapasitas 10 kursi).` })
  if (heavyMeet.length) alerts.push({ level: 'warn', text: `Meeting ≥ 4 jam hari ini: ${heavyMeet.map((x) => `${x.name} (${fmtDur(x.meeting)})`).join(', ')}.` })
  if (lowFocus.length) alerts.push({ level: 'warn', text: `Waktu fokus kurang dari 2 jam: ${lowFocus.map((x) => x.name).join(', ')}.` })
  if (longCommute.length) alerts.push({ level: 'warn', text: `Perjalanan pulang-pergi ≥ 2,5 jam: ${longCommute.map((x) => `${x.name} (${fmtDur(x.road)})`).join(', ')}.` })
  if (office.length && !good.length) alerts.push({ level: 'bad', text: 'Tidak ada slot ≥ 30 menit saat semua yang ke kantor hadir dan bebas meeting.' })

  const lines = []
  if (members.length) lines.push(`${office.length} dari ${members.length} orang ke kantor, ${wfh.length} WFH.`)
  if (sessions.size) lines.push(`Ada ${sessions.size} sesi meeting dengan total ${fmtDur(total.meeting)} waktu orang (${pct(total.meeting, work)}% dari jam kerja tim).`)
  if (commuters.length) lines.push(`Rata-rata perjalanan ${fmtDur(avg(roundTrips))} per orang (pulang-pergi); ${topBucket && topBucket.n ? `terbanyak ${topBucket.label} sekali jalan (${topBucket.n} orang)` : ''}.`.replace('; .', '.'))

  return {
    peak: peak.count > 0 ? { count: peak.count, from: peak.at, to: peak.at + step } : null,
    slots: good.map((s) => ({ from: s.a, to: s.b, text: `${fmtTime(s.a)}–${fmtTime(s.b)} (${fmtDur(s.b - s.a)})` })),
    least: least ? { name: least.m.name, fokus: least.st.fokus } : null,
    counts: { all: members.length, office: office.length, wfh: wfh.length },
    arrive: office.length ? { avg: avg(arrivals), earliest: { name: earliest.name, at: earliest.model.arrive }, latest: { name: latest.name, at: latest.model.leave }, avgLeave: avg(leaves) } : null,
    meeting: {
      total: total.meeting,
      avg: avg(rows.map((r) => r.st.meeting)),
      share: pct(total.meeting, work),
      sessions: sessions.size,
      people: meetingRows.length,
      most: most && most.st.meeting > 0 ? { name: most.m.name, minutes: most.st.meeting } : null,
      peakFill: peak.count > 0 ? pct(peak.count, 10) : 0,
    },
    commute: {
      count: commuters.length,
      total: total.road,
      avgRound: avg(roundTrips),
      avgOne: avg(oneWay),
      longest: longest ? { name: longest.m.name, minutes: longest.st.road, home: longest.m.home?.label } : null,
      shortest: shortest ? { name: shortest.m.name, minutes: shortest.st.road } : null,
      buckets,
      shareOfDay: pct(total.road, total.road + work),
    },
    focus: { total: total.fokus, avg: avg(rows.map((r) => r.st.fokus)), share: pct(total.fokus, work), low: lowFocus.length },
    lunch: { avg: avg(lunchLens), peak: lunch.count > 0 ? { count: lunch.count, from: lunch.at, to: lunch.at + step } : null },
    total,
    head,
    perPerson: rows.map(({ m, st }) => ({ id: m.id, name: m.name, role: m.role, wfh: m.model.wfh, color: m.color, ...st })).sort((a, b) => b.meeting + b.road - (a.meeting + a.road)),
    alerts,
    lines,
  }
}
