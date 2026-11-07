import { Icon } from './icons.jsx'

export default function Intro({ hasSaved, err3d, view, onView, canGL, real, onReal, onPlay, onSetup, onSample }) {
  return (
    <div className="intro">
      <div className="intro-card glass">
        <div className="logo" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="56" height="56"><path d="M8 33c9 0 6-18 16-18s7 18 16 18" fill="none" stroke="url(#g)" strokeWidth="5" strokeLinecap="round" /><defs><linearGradient id="g" x1="0" x2="1"><stop stopColor="#22d3ee" /><stop offset="1" stopColor="#a78bfa" /></linearGradient></defs></svg>
        </div>
        <h1>Jejak Sehari</h1>
        <p>Lihat ke mana harimu pergi</p>
        <div className="view-pick" role="group" aria-label="Pilih tampilan">
          <button className={view === '3d' ? 'on' : ''} disabled={!canGL} onClick={() => onView('3d')}>
            <b>Kota 3D</b><span>{canGL ? 'Animasi lengkap' : 'Tidak didukung perangkat'}</span>
          </button>
          <button className={view === '2d' ? 'on' : ''} onClick={() => onView('2d')}>
            <b>Peta 2D</b><span>Jalan asli, ringan</span>
          </button>
        </div>
        <p className={`webgl-note ${canGL ? '' : 'bad'}`} role="note">
          <Icon name={canGL ? 'info' : 'warn'} size={14} />
          {canGL
            ? 'Web ini membutuhkan WebGL untuk tampilan Kota 3D. Pastikan akselerasi hardware aktif di browser; jika tidak, pilih Peta 2D.'
            : 'WebGL tidak terdeteksi di perangkat ini, jadi Kota 3D tidak bisa dipakai. Aktifkan akselerasi hardware di pengaturan browser, atau gunakan Peta 2D.'}
        </p>
        {err3d && (
          <p className="webgl-note bad" role="alert">
            <Icon name="warn" size={14} />
            <span>Kota 3D gagal dijalankan, jadi dipakai Peta 2D. Detail: <code>{err3d}</code></span>
          </p>
        )}
        <div className="intro-actions">
          {hasSaved ? (
            <>
              <button className="btn primary big" onClick={onPlay}>Putar Hariku</button>
              <button className="btn big" onClick={onSetup}>Ubah jadwalku</button>
              <button className="btn big ghost" onClick={onSample}>Pakai data contoh</button>
            </>
          ) : (
            <>
              <button className="btn primary big" onClick={onSetup}>Isi jadwalku dulu</button>
              <button className="btn big" onClick={onSample}>Pakai data contoh</button>
            </>
          )}
        </div>
        <label className="check intro-real">
          <input type="checkbox" checked={real} onChange={(e) => onReal(e.target.checked)} />
          Mulai dengan waktu nyata (ikut jam sekarang)
        </label>
        <p className="intro-note">Hanya jadwalmu yang perlu diisi. Rekan tim memakai data contoh.</p>
      </div>
    </div>
  )
}
