import { useEffect, useState } from 'react'
import { SLICES } from '../../lib/share.js'
import { fmtDur } from '../../lib/time.js'

export default function Donut({ stats }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const total = SLICES.reduce((s, x) => s + (stats[x.key] || 0), 0)
  const R = 46
  const C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" role="img" aria-label="Pembagian waktu harian">
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="14" />
        {total > 0 &&
          SLICES.map((s) => {
            const v = stats[s.key] || 0
            if (!v) return null
            const len = (v / total) * C
            const el = (
              <circle
                key={s.key}
                cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="14"
                strokeDasharray={`${on ? Math.max(0, len - 1.5) : 0} ${C}`}
                strokeDashoffset={-acc}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)' }}
              />
            )
            acc += len
            return el
          })}
        <text x="60" y="58" textAnchor="middle" className="donut-big">{(total / 60).toFixed(1).replace('.', ',')}</text>
        <text x="60" y="72" textAnchor="middle" className="donut-sm">jam</text>
      </svg>
      <ul className="legend">
        {SLICES.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <b>{fmtDur(stats[s.key] || 0)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}
