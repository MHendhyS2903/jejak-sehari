import { useMemo, useState } from 'react'
import { Icon } from './icons.jsx'
import { DAYS, parseInput, toInput } from '../../lib/time.js'
import {
  TYPES, TYPE_META, cloneEvents, isRange, makeEvent, reorderMiddle, sortEvents, validateEvents,
} from '../../lib/schedule.js'

export default function ScheduleEditor({ dayId, day, onChange, onCopy }) {
  const [dragId, setDragId] = useState(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [targets, setTargets] = useState({})
  const events = useMemo(() => sortEvents(day.events), [day.events])
  const errors = useMemo(() => validateEvents(day.events, day.mode), [day])
  const set = (events2) => onChange({ ...day, events: events2 })
  const patch = (id, p) => set(day.events.map((e) => (e.id === id ? { ...e, ...p } : e)))

  const setType = (e, type) => {
    const n = { ...e, type }
    if (isRange(type) && n.end == null) n.end = Math.min(1439, e.start + 60)
    if (!isRange(type)) delete n.end
    set(day.events.map((x) => (x.id === e.id ? n : x)))
  }

  const setStart = (e, v) => {
    const m = parseInput(v)
    if (m == null) return
    patch(e.id, isRange(e.type) ? { start: m, end: Math.min(1439, m + (e.end - e.start)) } : { start: m })
  }

  const add = (type) => {
    const mids = events.filter((e) => isRange(e.type))
    let start = type === 'berangkat' ? 420 : type === 'pulang' ? 1020 : mids.length ? Math.min(1380, mids[mids.length - 1].end) : 600
    set([...day.events, makeEvent(type, start)])
  }

  const move = (id, dir) => {
    const mids = events.filter((e) => isRange(e.type))
    const i = mids.findIndex((e) => e.id === id)
    const j = i + dir
    if (j < 0 || j >= mids.length) return
    set(reorderMiddle(day.events, id, mids[j].id))
  }

  const doCopy = () => {
    const ids = Object.keys(targets).filter((k) => targets[k])
    if (ids.length) onCopy(ids)
    setCopyOpen(false)
    setTargets({})
  }

  return (
    <div className="editor">
      <div className="seg" role="group" aria-label="Mode hari">
        {[['kantor', 'Ke kantor'], ['wfh', 'WFH']].map(([k, l]) => (
          <button key={k} className={day.mode === k ? 'on' : ''} onClick={() => onChange({ ...day, mode: k })}>{l}</button>
        ))}
      </div>
      {day.mode === 'wfh' && <p className="hint">Hari WFH: tidak ada perjalanan, aktivitas tampil di rumah.</p>}

      <ul className="events">
        {events.length === 0 && <li className="empty">Belum ada agenda. Tambahkan di bawah.</li>}
        {events.map((e) => {
          const meta = TYPE_META[e.type]
          const mid = isRange(e.type)
          return (
            <li
              key={e.id}
              className={`ev ${errors[e.id] ? 'bad' : ''} ${dragId === e.id ? 'drag' : ''}`}
              style={{ '--c': meta.color }}
              draggable={mid}
              onDragStart={() => mid && setDragId(e.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(ev) => mid && dragId && ev.preventDefault()}
              onDrop={() => {
                if (mid && dragId && dragId !== e.id) set(reorderMiddle(day.events, dragId, e.id))
                setDragId(null)
              }}
            >
              <span className={`grip ${mid ? '' : 'off'}`} title={mid ? 'Seret untuk urutkan' : ''}><Icon name="drag" size={16} /></span>
              <select aria-label="Tipe" value={e.type} onChange={(ev) => setType(e, ev.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
              </select>
              <input type="time" aria-label="Mulai" value={toInput(e.start)} onChange={(ev) => setStart(e, ev.target.value)} />
              {mid ? (
                <>
                  <span className="dash">–</span>
                  <input type="time" aria-label="Selesai" value={toInput(e.end)} onChange={(ev) => { const m = parseInput(ev.target.value); if (m != null) patch(e.id, { end: m }) }} />
                </>
              ) : <span className="dash spacer" />}
              <span className="mv">
                <button aria-label="Naik" disabled={!mid} onClick={() => move(e.id, -1)}>▲</button>
                <button aria-label="Turun" disabled={!mid} onClick={() => move(e.id, 1)}>▼</button>
              </span>
              <button className="icon-btn" aria-label="Hapus" onClick={() => set(day.events.filter((x) => x.id !== e.id))}><Icon name="trash" size={16} /></button>
              {errors[e.id] && <div className="err"><Icon name="warn" size={13} /> {errors[e.id]}</div>}
            </li>
          )
        })}
      </ul>

      <div className="addrow">
        {TYPES.filter((t) => day.mode !== 'wfh' || isRange(t)).map((t) => (
          <button key={t} className="chip" style={{ '--c': TYPE_META[t].color }} onClick={() => add(t)}>
            <Icon name="plus" size={13} /> {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <div className="copy">
        <button className="btn ghost" onClick={() => setCopyOpen((v) => !v)}><Icon name="copy" size={16} /> Salin ke hari lain</button>
        {copyOpen && (
          <div className="copybox">
            {DAYS.filter((d) => d.id !== dayId).map((d) => (
              <label key={d.id}>
                <input type="checkbox" checked={!!targets[d.id]} onChange={(ev) => setTargets({ ...targets, [d.id]: ev.target.checked })} />
                {d.label}
              </label>
            ))}
            <button className="btn" onClick={doCopy}>Salin</button>
          </div>
        )}
      </div>
    </div>
  )
}

export { cloneEvents }
