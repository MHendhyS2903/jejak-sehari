import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons.jsx'
import { drawShareCard } from '../../lib/share.js'
import { decodeShare, encodeShare, sharePayload } from '../../lib/team.js'

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal glass" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup"><Icon name="close" /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function ShareModal({ data, onClose }) {
  const canvas = useRef()
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true
    const c = document.createElement('canvas')
    drawShareCard(c, data).then(() => {
      if (alive) {
        canvas.current = c
        setUrl(c.toDataURL('image/png'))
      }
    })
    return () => { alive = false }
  }, [data])
  const download = () => {
    canvas.current?.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `jejak-sehari-${data.dayLabel.toLowerCase()}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    }, 'image/png')
  }
  return (
    <Modal title="Bagikan Hariku" onClose={onClose}>
      <div className="sharebox">{url ? <img src={url} alt="Kartu ringkasan hari" /> : <p className="hint">Menyiapkan kartu…</p>}</div>
      <button className="btn primary wide" disabled={!url} onClick={download}><Icon name="download" size={17} /> Unduh PNG</button>
    </Modal>
  )
}

function download(name, text, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function ShareMeModal({ person, onClose }) {
  const [name, setName] = useState(person.name || '')
  const [role, setRole] = useState(person.role || '')
  const [copied, setCopied] = useState(false)
  const p = { ...person, name: name || 'Anggota', role: role || 'Anggota tim' }
  const code = encodeShare(p)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      document.getElementById('share-code')?.select()
    }
  }
  return (
    <Modal title="Bagikan jadwalku" onClose={onClose}>
      <p className="hint">Kirim kode ini ke atasan atau rekan. Mereka menempelkannya di "Tambah anggota". Tidak ada data yang dikirim ke server.</p>
      <div className="form2">
        <label>Nama<input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} /></label>
        <label>Peran<input value={role} maxLength={40} onChange={(e) => setRole(e.target.value)} /></label>
      </div>
      <textarea id="share-code" className="code" readOnly value={code} rows={5} onFocus={(e) => e.target.select()} />
      <div className="btnrow">
        <button className="btn primary" onClick={copy}><Icon name="copy" size={15} /> {copied ? 'Tersalin' : 'Salin kode'}</button>
        <button className="btn" onClick={() => download('jadwalku-jejak-sehari.json', JSON.stringify(sharePayload(p), null, 2), 'application/json')}><Icon name="download" size={15} /> Unduh JSON</button>
      </div>
    </Modal>
  )
}

export function AddMemberModal({ colorIndex, onAdd, onClose }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const submit = (t) => {
    try {
      onAdd(decodeShare(t, colorIndex))
      onClose()
    } catch (e) {
      setErr(e.message || 'Kode tidak valid')
    }
  }
  return (
    <Modal title="Tambah anggota" onClose={onClose}>
      <p className="hint">Tempel kode (JS1:…) atau JSON jadwal dari rekan, atau pilih file JSON.</p>
      <textarea className="code" rows={5} value={text} placeholder="JS1:eyJuYW1lIjoi…" onChange={(e) => { setText(e.target.value); setErr('') }} />
      {err && <p className="err"><Icon name="warn" size={13} /> {err}</p>}
      <div className="btnrow">
        <button className="btn primary" onClick={() => submit(text)}><Icon name="plus" size={15} /> Tambahkan</button>
        <label className="btn">
          <Icon name="upload" size={15} /> Pilih file
          <input type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) submit(await f.text()); e.target.value = '' }} />
        </label>
      </div>
    </Modal>
  )
}
