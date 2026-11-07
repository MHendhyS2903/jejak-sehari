import { useRef } from 'react'
import { Icon } from './icons.jsx'
import { PRESETS, findPreset } from '../../data/locations.js'
import { fmtDur } from '../../lib/time.js'
import { ACCENTS } from '../scene/sky.js'
import { WEATHER_MODES } from '../../lib/atmosphere.js'

export function LocationField({ title, value, onChange }) {
  const isManual = value.presetId === 'manual'
  const pick = (id) => {
    if (id === 'manual') return onChange({ ...value, presetId: 'manual' })
    const p = findPreset(id)
    onChange({ ...value, presetId: id, lat: p.lat, lng: p.lng })
  }
  const num = (k, v) => {
    const n = parseFloat(v)
    if (Number.isFinite(n)) onChange({ ...value, presetId: 'manual', [k]: n })
  }
  return (
    <fieldset className="loc">
      <legend>{title}</legend>
      <label>Nama tampilan
        <input type="text" maxLength={80} value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
      </label>
      <label>Area
        <select value={isManual ? 'manual' : value.presetId} onChange={(e) => pick(e.target.value)}>
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="manual">Koordinat manual…</option>
        </select>
      </label>
      {isManual && (
        <div className="coords">
          <label>Lat<input type="number" step="0.0001" value={value.lat} onChange={(e) => num('lat', e.target.value)} /></label>
          <label>Lng<input type="number" step="0.0001" value={value.lng} onChange={(e) => num('lng', e.target.value)} /></label>
        </div>
      )}
    </fieldset>
  )
}

export default function SettingsView({
  schedule, onChange, route, travel, onRefresh, quality, onQuality, view, onView, canGL, storageOk, weather, onWeather,
  onSample, onReset, onExport, onImport,
}) {
  const file = useRef()
  const t = travel(420)
  return (
    <div className="settings">
      <LocationField title="Rumah" value={schedule.home} onChange={(home) => onChange({ home })} />
      <LocationField title="Kantor" value={schedule.office} onChange={(office) => onChange({ office })} />

      <section className="card">
        <h4>Waktu perjalanan</h4>
        <p className="est">
          Jarak ±{route.entry.km.toFixed(1)} km · {route.loading ? 'mengambil data…' : route.entry.source === 'osrm' ? 'estimasi (OSRM)' : 'estimasi offline'}
          {!schedule.manualMinutes && <> · jam 07.00 ≈ {fmtDur(t.minutes)} (×{t.factor})</>}
        </p>
        <button className="btn ghost" onClick={onRefresh} disabled={route.loading}><Icon name="reset" size={15} /> Hitung ulang</button>
        <label className="check">
          <input type="checkbox" checked={!!schedule.manualMinutes} onChange={(e) => onChange({ manualMinutes: e.target.checked ? Math.round(t.minutes) : null })} />
          Atur durasi manual
        </label>
        {schedule.manualMinutes ? (
          <label>Durasi sekali jalan (menit)
            <input type="number" min="5" max="300" value={schedule.manualMinutes} onChange={(e) => onChange({ manualMinutes: Math.max(5, Math.min(300, parseInt(e.target.value, 10) || 5)) })} />
          </label>
        ) : null}
        <p className="hint">Rute di kota 3D bersifat stilistik. Peta 2D memakai jalur jalan asli.</p>
      </section>

      <section className="card">
        <h4>Tampilan</h4>
        <div className="swatches" role="group" aria-label="Warna mobil">
          {Object.entries(ACCENTS).map(([k, c]) => (
            <button key={k} className={schedule.accent === k ? 'on' : ''} style={{ '--c': c }} onClick={() => onChange({ accent: k })} aria-label={`Warna ${k}`} />
          ))}
        </div>
        <label>Jenis tampilan
          <select value={view} onChange={(e) => onView(e.target.value)}>
            <option value="3d" disabled={!canGL}>Kota 3D{canGL ? '' : ' (tidak didukung perangkat ini)'}</option>
            <option value="2d">Peta 2D (jalur jalan asli)</option>
          </select>
        </label>
        {!canGL && <p className="hint warn"><Icon name="info" size={13} /> WebGL tidak tersedia, jadi aplikasi memakai Peta 2D. Coba aktifkan akselerasi hardware di pengaturan browser.</p>}
        {view === '2d' && <p className="hint">Peta 2D memakai data jalan Jabodetabek yang tertanam, jadi bisa dipakai tanpa internet. Hanya jalur rute yang diambil dari OSRM; tanpa internet dipakai garis lurus.</p>}
        <label>Cuaca kota
          <select value={weather} onChange={(e) => onWeather(e.target.value)}>
            {WEATHER_MODES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </label>
        <label>Kualitas grafis 3D
          <select value={quality} onChange={(e) => onQuality(e.target.value)}>
            <option value="auto">Otomatis</option>
            <option value="tinggi">Tinggi (bloom + bayangan)</option>
            <option value="rendah">Rendah (hemat daya)</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h4>Data</h4>
        <div className="btnrow">
          <button className="btn" onClick={onSample}>Coba data contoh</button>
          <button className="btn" onClick={onReset}><Icon name="reset" size={15} /> Reset</button>
          <button className="btn" onClick={onExport}><Icon name="download" size={15} /> Export</button>
          <button className="btn" onClick={() => file.current.click()}><Icon name="upload" size={15} /> Import</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
        </div>
        {!storageOk && <p className="hint warn"><Icon name="info" size={13} /> Mode tanpa penyimpanan: jadwal hanya tersimpan selama halaman terbuka. Gunakan Export untuk menyimpan.</p>}
      </section>
    </div>
  )
}
