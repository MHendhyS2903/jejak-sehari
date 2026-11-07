import { Icon } from './icons.jsx'
import ScheduleEditor from './ScheduleEditor.jsx'
import { LocationField } from './SettingsView.jsx'
import { DAYS } from '../../lib/time.js'
import { validateEvents } from '../../lib/schedule.js'

export default function Setup({ schedule, onPatch, onSetDay, onSelectDay, onCopy, real, onReal, onSample, onBack, onPlay }) {
  const day = schedule.days[schedule.activeDay]
  const meta = DAYS.find((d) => d.id === schedule.activeDay)
  const bad = DAYS.filter((d) => Object.keys(validateEvents(schedule.days[d.id].events, schedule.days[d.id].mode)).length > 0)
  const empty = DAYS.every((d) => schedule.days[d.id].events.filter((e) => e.type !== 'berangkat' && e.type !== 'pulang').length === 0)
  return (
    <div className="setup" role="dialog" aria-label="Isi jadwal">
      <div className="setup-card glass">
        <header>
          <h2>Isi jadwal harimu</h2>
          <p className="hint">Isi lokasi dan jadwal seharian untuk tiap hari kerja. Setelah selesai, tekan Putar. Rekan tim tetap memakai data contoh.</p>
        </header>

        <section className="settings">
          <h3>1 · Lokasi</h3>
          <LocationField title="Rumah" value={schedule.home} onChange={(home) => onPatch({ home })} />
          <LocationField title="Kantor" value={schedule.office} onChange={(office) => onPatch({ office })} />
        </section>

        <section>
          <h3>2 · Jadwal seharian</h3>
          <nav className="days setup-days" aria-label="Pilih hari">
            {DAYS.map((d) => (
              <button key={d.id} className={schedule.activeDay === d.id ? 'on' : ''} onClick={() => onSelectDay(d.id)}>
                {d.short}{schedule.days[d.id].mode === 'wfh' ? <sup>WFH</sup> : null}
              </button>
            ))}
          </nav>
          <h4 className="setup-day">{meta.label}</h4>
          <ScheduleEditor dayId={schedule.activeDay} day={day} onChange={onSetDay} onCopy={onCopy} />
          {empty && <p className="hint">Tambahkan meeting, istirahat, atau kerja fokus supaya harimu terlihat lebih hidup. Gunakan "Salin ke hari lain" untuk mengisi hari lainnya.</p>}
        </section>

        <label className="check">
          <input type="checkbox" checked={real} onChange={(e) => onReal(e.target.checked)} />
          Putar dengan waktu nyata (ikut jam sekarang)
        </label>
        {bad.length > 0 && (
          <p className="err"><Icon name="warn" size={13} /> Perbaiki jadwal yang bertabrakan di: {bad.map((d) => d.label).join(', ')}.</p>
        )}
        <div className="setup-actions">
          <button className="btn" onClick={onBack}>Kembali</button>
          <button className="btn" onClick={onSample}>Isi dengan data contoh</button>
          <button className="btn primary big" disabled={bad.length > 0} onClick={onPlay}><Icon name="play" size={16} fill /> Putar Hariku</button>
        </div>
      </div>
    </div>
  )
}
