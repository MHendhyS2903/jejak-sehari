import { useSyncExternalStore } from 'react'
import { playback } from '../../lib/playback.js'
import { TYPE_META } from '../../lib/schedule.js'
import { fmtTime } from '../../lib/time.js'
import { ZONE } from '../../lib/behavior.js'
import { weatherAt } from '../../lib/atmosphere.js'

export function phaseText(model, st) {
  const cur = st.active >= 0 ? model.items[st.active] : null
  if (model.wfh) return cur ? `${TYPE_META[cur.type].label} · di rumah` : 'WFH · di rumah'
  switch (st.kind) {
    case 'pre': return 'Bersiap di rumah'
    case 'out': return 'Di jalan · menuju kantor'
    case 'enter': return 'Tiba di kantor'
    case 'office': {
      if (!cur) return 'Di kantor · Area Kerja'
      const z = cur.type === 'meeting' ? ZONE.meeting : cur.type === 'istirahat' ? ZONE.pantry : ZONE.kerja
      return `${TYPE_META[cur.type].label} · ${z}`
    }
    case 'exitin': return 'Pulang · keluar kantor'
    case 'exitout': return 'Menuju mobil'
    case 'back': return 'Di jalan · pulang'
    default: return 'Sudah di rumah'
  }
}

export default function Clock({ model, tl, mode, weather = 'cerah', dayId = 'sen' }) {
  const pb = useSyncExternalStore(playback.subscribe, playback.getSnapshot)
  const st = tl.stateAt(pb.progress)
  const shown = pb.real ? pb.realMinute : st.minute
  const w = weatherAt(shown, weather, dayId)
  const ms = mode === 'tim' ? null : model.stateAt(pb.progress)
  const leg = ms?.driving ? (ms.kind === 'out' ? model.out : model.back) : null
  let outside = ''
  if (pb.real && tl.t0 != null) {
    const nm = Math.floor(pb.realMinute)
    if (nm < tl.t0 || nm > tl.t1) outside = `Waktu nyata ${fmtTime(nm)} · di luar jam jadwal hari ini`
  }
  const jam = leg && leg.factor >= 1.5 ? Math.round(leg.minutes * (1 - 1.2 / leg.factor)) : 0
  return (
    <div className="clock" aria-live="off">
      <div className="digits">{fmtTime(shown, ':')}</div>
      <div className="phase">
        <i className={st.driving ? 'drive' : ''} />
        {mode === 'tim' ? 'Bos View' : phaseText(model, model.stateAt(pb.progress))}
      </div>
      <div className="chips">
        <span className="chip-w">{w.rain > 0.1 ? '🌧' : w.cloud > 0.6 ? '⛅' : '☀️'} {w.label} · {w.temp}°C</span>
        {pb.real && <span className="chip-real">● Waktu nyata</span>}
        {outside && <span className="chip-jam">{outside}</span>}
        {jam > 0 && <span className="chip-jam">Macet di Jalan Raya · +{jam} menit</span>}
      </div>
    </div>
  )
}
