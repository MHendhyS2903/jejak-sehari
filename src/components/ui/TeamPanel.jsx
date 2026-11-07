import { useMemo, useState, useSyncExternalStore } from 'react'
import { Icon } from './icons.jsx'
import { playback } from '../../lib/playback.js'
import { ACT_LABEL, statusAt } from '../../lib/behavior.js'
import { fmtDur, fmtTime } from '../../lib/time.js'
import { teamInsight } from '../../lib/teamInsight.js'
import Donut from './Donut.jsx'
import { TYPE_META } from '../../lib/schedule.js'

function useMinute(tl) {
  const pb = useSyncExternalStore(playback.subscribe, playback.getSnapshot)
  return tl.stateAt(pb.progress).minute
}

const actText = (st) => ACT_LABEL[st.act] || TYPE_META[st.act]?.label || 'Bekerja'

const FILTERS = [
  ['all', 'Semua'], ['meeting', 'Meeting'], ['fokus', 'Fokus'], ['istirahat', 'Istirahat'], ['wfh', 'WFH'],
]

const matchFilter = (f, st) => {
  if (f === 'all') return true
  if (f === 'wfh') return st.loc === 'wfh'
  if (f === 'fokus') return ['fokus', 'lain', 'ngobrol', 'printer'].includes(st.act) && st.loc !== 'rumah' && st.loc !== 'jalan'
  return st.act === f
}

export function TeamStatus({ members, tl, selectedId, onSelect, onWatch, onShare, onAdd, onRemove }) {
  const minute = useMinute(tl)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const rows = members.map((m) => ({ m, st: statusAt(m.model, minute, m) }))
  const count = (f) => rows.filter(f).length
  const sum = [
    ['Meeting', count((r) => r.st.act === 'meeting'), TYPE_META.meeting.color],
    ['Fokus', count((r) => matchFilter('fokus', r.st)), TYPE_META.fokus.color],
    ['Istirahat', count((r) => r.st.act === 'istirahat'), TYPE_META.istirahat.color],
    ['Di jalan', count((r) => r.st.loc === 'jalan'), TYPE_META.berangkat.color],
    ['WFH', count((r) => r.st.loc === 'wfh'), '#94a3b8'],
  ]
  const shown = rows.filter(({ m, st }) => matchFilter(filter, st) && (!q || `${m.name} ${m.role}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="team">
      <p className="hint">Status berasal dari jadwal yang dibuat tiap pekerja, bukan pelacakan lokasi asli. Tekan "Lihat hari" untuk menonton satu hari pekerja seperti view Hariku.</p>
      <div className="sum">
        {sum.map(([l, n, c]) => (
          <div key={l} style={{ '--c': c }}><b>{n}</b><span>{l}</span></div>
        ))}
      </div>
      <input className="search" type="search" placeholder="Cari nama atau peran…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari pekerja" />
      <div className="filters" role="group" aria-label="Filter status">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <ul className="cards">
        {shown.length === 0 && <li className="empty">Tidak ada pekerja yang cocok.</li>}
        {shown.map(({ m, st }) => (
          <li key={m.id}>
            <button className={`tcard ${selectedId === m.id ? 'sel' : ''}`} style={{ '--c': m.color }} onClick={() => onSelect(m.id)}>
              <span className="av">{m.name.slice(0, 1)}</span>
              <span className="tx">
                <b>{m.name}</b>
                <small>{m.role}</small>
                <em>{st.zone} · {actText(st)}{st.until != null ? ` · sampai ${fmtTime(st.until)}` : ''}</em>
              </span>
              {st.loc === 'wfh' && <span className="wfh">WFH</span>}
              <span className="x watch" role="button" tabIndex={0} aria-label={`Lihat hari ${m.name}`} title="Lihat harinya seperti view Hariku" onClick={(e) => { e.stopPropagation(); onWatch(m.id) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onWatch(m.id) } }}>
                <Icon name="play" size={13} fill /> Lihat hari
              </span>
              {m.custom && <span className="x" role="button" aria-label="Hapus anggota" onClick={(e) => { e.stopPropagation(); onRemove(m.id) }}><Icon name="close" size={14} /></span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="btnrow">
        <button className="btn primary" onClick={onShare}><Icon name="share" size={15} /> Bagikan jadwalku</button>
        <button className="btn" onClick={onAdd}><Icon name="plus" size={15} /> Tambah anggota</button>
      </div>
    </div>
  )
}

export function TeamInsights({ members, dayLabel = '' }) {
  const ins = useMemo(() => teamInsight(members), [members])
  const maxHead = Math.max(1, ...ins.head.map((h) => h.office + h.road))
  const maxP = Math.max(1, ...ins.perPerson.map((p) => p.road + p.meeting + p.istirahat + p.fokus + p.lain))
  const tile = (v, l) => (<div><b>{v}</b><span>{l}</span></div>)
  return (
    <div className="insight">
      <section className="card">
        <h4><Icon name="info" size={16} /> Ringkasan {dayLabel}</h4>
        <div className="stats3">
          {tile(`${ins.counts.office}/${ins.counts.all}`, 'ke kantor')}
          {tile(ins.counts.wfh, 'WFH')}
          {tile(ins.meeting.sessions, 'sesi meeting')}
        </div>
        {ins.lines.map((l, i) => <p key={i} className="auto">{l}</p>)}
      </section>

      {ins.alerts.length > 0 && (
        <section className="card">
          <h4><Icon name="warn" size={16} /> Perlu perhatian</h4>
          <ul className="warns">
            {ins.alerts.map((a, i) => <li key={i} className={a.level}><Icon name="warn" size={14} />{a.text}</li>)}
          </ul>
        </section>
      )}

      <section className="card">
        <h4><Icon name="meeting" size={16} /> Meeting</h4>
        <div className="stats3">
          {tile(fmtDur(ins.meeting.total), 'total waktu orang')}
          {tile(fmtDur(ins.meeting.avg), 'rata-rata per orang')}
          {tile(`${ins.meeting.share}%`, 'dari jam kerja')}
        </div>
        {ins.peak ? <p>Puncak: <b>{fmtTime(ins.peak.from)}–{fmtTime(ins.peak.to)}</b>, {ins.peak.count} orang sekaligus ({ins.meeting.peakFill}% kapasitas ruang).</p> : <p>Tidak ada meeting hari ini.</p>}
        {ins.meeting.most && <p className="est">Paling banyak meeting: <b>{ins.meeting.most.name}</b> ({fmtDur(ins.meeting.most.minutes)}). {ins.meeting.people} orang punya meeting hari ini.</p>}
      </section>

      <section className="card">
        <h4><Icon name="berangkat" size={16} /> Perjalanan</h4>
        {ins.commute.count ? (
          <>
            <div className="stats3">
              {tile(fmtDur(ins.commute.avgRound), 'rata-rata pulang-pergi')}
              {tile(fmtDur(ins.commute.total), 'total di jalan')}
              {tile(`${ins.commute.shareOfDay}%`, 'dari waktu tim')}
            </div>
            <div className="dist">
              {ins.commute.buckets.map((b) => (
                <div key={b.label}>
                  <span>{b.label}</span>
                  <div className="bar"><i style={{ width: `${pct100(b.n, ins.commute.count)}%` }} /></div>
                  <b>{b.n}</b>
                </div>
              ))}
            </div>
            <p className="est">Perjalanan sekali jalan rata-rata {fmtDur(ins.commute.avgOne)}. Terjauh: <b>{ins.commute.longest.name}</b> ({fmtDur(ins.commute.longest.minutes)} pulang-pergi{ins.commute.longest.home ? `, ${ins.commute.longest.home.replace('Rumah, ', '')}` : ''}). Tersingkat: {ins.commute.shortest.name} ({fmtDur(ins.commute.shortest.minutes)}).</p>
          </>
        ) : <p>Semua WFH hari ini, tidak ada perjalanan.</p>}
      </section>

      <section className="card">
        <h4><Icon name="fokus" size={16} /> Fokus & istirahat</h4>
        <div className="stats3">
          {tile(fmtDur(ins.focus.avg), 'fokus per orang')}
          {tile(`${ins.focus.share}%`, 'dari jam kerja')}
          {tile(ins.lunch.avg ? fmtDur(ins.lunch.avg) : '—', 'rata-rata istirahat')}
        </div>
        {ins.lunch.peak && <p className="est">Istirahat paling ramai <b>{fmtTime(ins.lunch.peak.from)}–{fmtTime(ins.lunch.peak.to)}</b> ({ins.lunch.peak.count} orang bersamaan di pantry/istirahat).</p>}
        {ins.least && <p className="est">Fokus paling sedikit: <b>{ins.least.name}</b> ({Math.round(ins.least.fokus / 6) / 10} jam).</p>}
      </section>

      {ins.arrive && (
        <section className="card">
          <h4>Kehadiran</h4>
          <div className="stats3">
            {tile(fmtTime(ins.arrive.avg), 'rata-rata tiba')}
            {tile(fmtTime(ins.arrive.avgLeave), 'rata-rata pulang')}
            {tile(ins.counts.office, 'di kantor')}
          </div>
          <p className="est">Tiba paling awal: <b>{ins.arrive.earliest.name}</b> ({fmtTime(ins.arrive.earliest.at)}). Pulang paling akhir: <b>{ins.arrive.latest.name}</b> ({fmtTime(ins.arrive.latest.at)}).</p>
          <div className="heads" role="img" aria-label="Jumlah orang di kantor dan di jalan per setengah jam">
            {ins.head.map((h) => (
              <div key={h.t} className="hcol" title={`${fmtTime(h.t)} · ${h.office} di kantor · ${h.road} di jalan`}>
                <i className="r" style={{ height: `${(h.road / maxHead) * 100}%` }} />
                <i className="o" style={{ height: `${(h.office / maxHead) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="hlab"><span>06.00</span><span>13.00</span><span>20.00</span></div>
          <p className="hint"><i className="dot o" /> di kantor <i className="dot r" /> di jalan</p>
        </section>
      )}

      <section className="card">
        <h4>Pembagian waktu seluruh tim</h4>
        <Donut stats={ins.total} />
      </section>

      <section className="card">
        <h4>Per orang</h4>
        <div className="weekbars">
          {ins.perPerson.map((p) => (
            <div key={p.id} className="wk wide">
              <span title={p.role}>{p.name}{p.wfh ? ' · WFH' : ''}</span>
              <div className="bar">
                {[['road', '#f472b6'], ['meeting', '#a78bfa'], ['istirahat', '#fbbf24'], ['fokus', '#22d3ee'], ['lain', '#64748b']].map(([k, c]) => <i key={k} style={{ width: `${(p[k] / maxP) * 100}%`, background: c }} />)}
              </div>
              <b>{(p.span + p.road) > 0 ? ((p.road + p.span) / 60).toFixed(1).replace('.', ',') : '0'}j</b>
            </div>
          ))}
        </div>
        <p className="hint">Merah muda: di jalan · ungu: meeting · kuning: istirahat · biru: fokus · abu: lainnya.</p>
      </section>

      <section className="card advice ok">
        <h4><Icon name="check" size={16} /> Slot meeting bersama</h4>
        {ins.slots.length ? (
          <>
            <p>Semua anggota yang ke kantor hadir dan tidak sedang meeting pada:</p>
            <ul className="slots">{ins.slots.map((s) => <li key={s.from}>{s.text}</li>)}</ul>
          </>
        ) : <p>Tidak ada slot ≥ 30 menit saat semua anggota di kantor dan bebas meeting.</p>}
        <p className="est">Anggota WFH tidak dihitung pada slot ini.</p>
      </section>
    </div>
  )
}

const pct100 = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)

const hm = (m) => fmtTime(m)

export function WatchPanel({ member, model, dayLabel, onBack }) {
  const rows = []
  if (!model.wfh && model.depart != null) rows.push({ k: 'berangkat', from: model.depart, label: 'Berangkat', note: `${Math.round(model.out.minutes)} mnt di jalan` })
  model.items.forEach((it) => rows.push({ k: it.id || `${it.type}-${it.start}`, type: it.type, from: it.start, to: it.end, label: TYPE_META[it.type].label }))
  if (!model.wfh && model.leave != null) rows.push({ k: 'pulang', from: model.leave, label: 'Pulang', note: `${Math.round(model.back.minutes)} mnt di jalan` })
  return (
    <div className="watch">
      <button className="btn" onClick={onBack}><Icon name="chevron" size={14} className="flip" /> Kembali ke Tim</button>
      <h3 className="ptitle">{member.name}</h3>
      <p className="hint">{member.role} · {dayLabel} · {model.wfh ? 'WFH di rumah' : 'ke kantor'}. Jadwal ini hanya dibaca; ubah jadwalmu sendiri di view Hariku.</p>
      <ul className="wlist">
        {rows.map((r) => (
          <li key={r.k} style={{ '--c': TYPE_META[r.type || r.k]?.color || '#94a3b8' }}>
            <b>{r.label}</b>
            <span>{hm(r.from)}{r.to != null ? `–${hm(r.to)}` : ''}</span>
            {r.note && <em>{r.note}</em>}
          </li>
        ))}
        {rows.length === 0 && <li className="empty">Tidak ada agenda hari ini.</li>}
      </ul>
    </div>
  )
}
