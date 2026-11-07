import { Icon } from './icons.jsx'
import Donut from './Donut.jsx'
import { fmtDur, fmtHours } from '../../lib/time.js'

export default function InsightView({ advice, warnings, stats, week, onShare, travelInfo, wfh }) {
  return (
    <div className="insight">
      {advice && (
        <section className={`card advice ${advice.status}`}>
          <h4><Icon name="berangkat" size={16} /> Rekomendasi jam berangkat</h4>
          <p>{advice.text}</p>
          {advice.note && <p className="note">{advice.note}</p>}
          {travelInfo && !wfh && <p className="est">Perjalanan {travelInfo}</p>}
        </section>
      )}

      {warnings.length > 0 && (
        <section className="card">
          <h4><Icon name="warn" size={16} /> Peringatan</h4>
          <ul className="warns">
            {warnings.map((w, i) => (
              <li key={i} className={w.level}><Icon name="warn" size={14} />{w.text}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h4>Breakdown waktu hari ini</h4>
        <Donut stats={stats} />
      </section>

      <section className="card">
        <h4>Ringkasan mingguan</h4>
        <div className="weekbars">
          {week.rows.map((r) => {
            const max = Math.max(...week.rows.map((x) => x.road + x.meeting + x.fokus + x.istirahat + x.lain), 1)
            const seg = (v, c) => <i style={{ width: `${(v / max) * 100}%`, background: c }} />
            return (
              <div key={r.id} className={`wk ${r.id === week.busiest.id ? 'peak' : ''}`}>
                <span>{r.short}{r.wfh ? ' · WFH' : ''}</span>
                <div className="bar">
                  {seg(r.road, '#f472b6')}{seg(r.meeting, '#a78bfa')}{seg(r.istirahat, '#fbbf24')}{seg(r.fokus, '#22d3ee')}{seg(r.lain, '#64748b')}
                </div>
                <b>{(r.busy / 60).toFixed(1).replace('.', ',')}j</b>
              </div>
            )
          })}
        </div>
        <div className="stats3">
          <div><b>{fmtHours(week.road)}</b><span>di jalan</span></div>
          <div><b>{fmtHours(week.meeting)}</b><span>meeting</span></div>
          <div><b>{fmtHours(week.fokus)}</b><span>fokus</span></div>
        </div>
        {week.lines.map((l, i) => <p key={i} className="auto">{l}</p>)}
        <p className="hint">Hari paling padat: <b>{week.busiest.label}</b> ({fmtDur(week.busiest.busy)} jalan + meeting)</p>
      </section>

      <button className="btn primary wide" onClick={onShare}><Icon name="share" size={17} /> Bagikan Hariku</button>
    </div>
  )
}
