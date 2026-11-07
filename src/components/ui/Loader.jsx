import { Component, useEffect, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { glbProgress } from '../scene/glb.js'

const STATUS = ['Membangun kota…', 'Menyalakan lampu jalan…', 'Menata meja kerja…', 'Menyeduh kopi di pantry…', 'Merapikan jadwalmu…']

export default function Loader({ ready, onDone }) {
  const progress = useSyncExternalStore(glbProgress.subscribe, glbProgress.get)
  const [i, setI] = useState(0)
  const [fontOk, setFontOk] = useState(false)
  const [minOk, setMinOk] = useState(false)
  const [slow, setSlow] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const a = setInterval(() => setI((v) => (v + 1) % STATUS.length), 1600)
    const b = setTimeout(() => setMinOk(true), 1000)
    const c = setTimeout(() => setSlow(true), 20000)
    ;(document.fonts?.ready ?? Promise.resolve()).then(() => setFontOk(true)).catch(() => setFontOk(true))
    return () => { clearInterval(a); clearTimeout(b); clearTimeout(c) }
  }, [])

  const done = ready && fontOk && minOk
  useEffect(() => {
    if (!done) return
    setLeaving(true)
    const t = setTimeout(onDone, 500)
    return () => clearTimeout(t)
  }, [done, onDone])

  const pct = ready ? 100 : Math.min(99, Math.round(progress))
  return (
    <div className={`loader ${leaving ? 'leaving' : ''}`} role="status">
      <div className="loader-card">
        <svg className="route" viewBox="0 0 220 60" aria-hidden="true">
          <path className="route-line" d="M8 46 C 40 46, 40 14, 74 14 S 112 46, 146 46 S 184 14, 212 14" />
          <circle className="route-dot" r="5" />
        </svg>
        <h1>Jejak Sehari</h1>
        {slow && !ready ? (
          <>
            <p className="lerr">Memuat lebih lama dari biasanya. Periksa koneksi lalu coba lagi.</p>
            <button className="btn primary" onClick={() => location.reload()}>Coba lagi</button>
          </>
        ) : (
          <>
            <div className="lbar"><i style={{ width: `${pct}%` }} /></div>
            <div className="lrow"><span>{STATUS[i]}</span><b>{pct}%</b></div>
          </>
        )}
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component {
  constructor(p) {
    super(p)
    this.state = { err: null }
  }
  static getDerivedStateFromError(err) {
    return { err }
  }
  componentDidCatch(err) {
    this.props.onError?.(err)
  }
  render() {
    if (!this.state.err) return this.props.children
    if (this.props.onError) return null
    return (
      <div className="loader">
        <div className="loader-card">
          <h1>Jejak Sehari</h1>
          <p className="lerr">Ada aset yang gagal dimuat. Muat ulang halaman untuk mencoba lagi.</p>
          <button className="btn primary" onClick={() => location.reload()}>Coba lagi</button>
        </div>
      </div>
    )
  }
}
