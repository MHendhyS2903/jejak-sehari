import { useSyncExternalStore } from 'react'
import { Icon } from './icons.jsx'
import { NORMAL, playback } from '../../lib/playback.js'

import { TYPE_META } from '../../lib/schedule.js'
import { fmtTime } from '../../lib/time.js'

const SPEEDS = [0.25, 0.5, 1, 2, 4]

export default function TimelineBar({ view = '3d', model, free, onFree, follow, onFollow, onReal }) {
  const pb = useSyncExternalStore(playback.subscribe, playback.getSnapshot)
  return (
    <div className="timeline glass">
      <button className="play" onClick={() => playback.toggle()} aria-label={pb.playing ? 'Jeda' : pb.progress >= 1 ? 'Putar ulang' : 'Putar'}>
        <Icon name={pb.playing ? 'pause' : 'play'} size={20} fill={!pb.playing} />
      </button>
      <div className="scrub">
        <div className="markers">
          {model.markers.map((m) => (
            <button
              key={m.id}
              className="mk"
              style={{ left: `${m.p * 100}%`, '--c': TYPE_META[m.type].color }}
              title={`${TYPE_META[m.type].label} ${fmtTime(m.m)}`}
              onClick={() => playback.seek(m.p)}
              aria-label={`${TYPE_META[m.type].label} ${fmtTime(m.m)}`}
            >
              <span>{fmtTime(m.m)}</span>
            </button>
          ))}
        </div>
        <input
          type="range" min="0" max="1000" step="1"
          value={Math.round(pb.progress * 1000)}
          onChange={(e) => playback.seek(+e.target.value / 1000)}
          aria-label="Timeline hari"
          style={{ '--p': `${pb.progress * 100}%` }}
        />
      </div>
      {view === '3d' && <button className={`cam ${free ? 'on' : ''}`} onClick={onFree} aria-pressed={free} title={free ? 'Kamera bebas (seret untuk memutar)' : 'Kamera sinematik'}>
        <Icon name="camera" size={17} /><span>{free ? 'Bebas' : 'Sinematik'}</span>
      </button>}
      <button className={`cam ${follow ? 'on' : ''}`} onClick={onFollow} aria-pressed={follow} title={view === '2d' ? 'Peta mengikuti mobil saat di jalan' : 'Kamera mengikuti karakter di interior'}>
        <Icon name="pin" size={17} /><span>Ikuti</span>
      </button>
      <div className="speeds" role="group" aria-label="Kecepatan">
        <button className={pb.real ? 'on real' : 'real'} onClick={onReal} aria-pressed={pb.real} title="Ikuti jam sekarang (waktu nyata)">Real</button>
        {SPEEDS.map((s) => (
          <button key={s} className={pb.speed === s * NORMAL && !pb.real ? 'on' : ''} onClick={() => playback.setSpeed(s * NORMAL)}>{s}×</button>
        ))}
      </div>
    </div>
  )
}
