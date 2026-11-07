import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { playback } from '../../lib/playback.js'
import { cachedGeometry, fetchGeometry, makeTrack } from '../../lib/geometry.js'
import { statusAt } from '../../lib/behavior.js'
import { phaseText } from '../ui/Clock.jsx'

import { BaseLayer, attachLabels, inCover } from './basemap.js'

const el = (tag, cls, text) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

function pinNode(kind, title, sub) {
  const root = el('div', `mpin ${kind}`)
  root.append(el('i'))
  const box = el('div', 'mpin-box')
  const t = el('b', '', title)
  const s = el('span', '', sub)
  box.append(t, s)
  root.append(box)
  return { root, sub: s }
}

function carNode(color) {
  const root = el('div', 'mcar')
  root.style.setProperty('--c', color)
  root.innerHTML =
    '<div class="mcar-in"><svg width="30" height="44" viewBox="0 0 30 44" aria-hidden="true">' +
    '<rect x="4" y="3" width="22" height="38" rx="9" fill="var(--c)" stroke="#0b1020" stroke-width="2"/>' +
    '<rect x="8" y="10" width="14" height="8" rx="3" fill="#0b1020" opacity=".85"/>' +
    '<rect x="8" y="27" width="14" height="6" rx="2.5" fill="#0b1020" opacity=".55"/></svg></div>'
  return { root, inner: root.firstChild }
}

const straight = (a, b) => [[a.lat, a.lng], [b.lat, b.lng]]

export default function MapView({ schedule, tl, model, mode, crew, follow, inset, accent, onReady }) {
  const host = useRef()
  const api = useRef({})
  const live = useRef({})
  const [approx, setApprox] = useState(false)
  const [outside, setOutside] = useState(false)
  live.current = { tl, model, mode, crew, follow, inset }
  const { home, office } = schedule

  useEffect(() => {
    const map = L.map(host.current, { zoomControl: false, attributionControl: false, zoomSnap: 0.25, minZoom: 8, maxZoom: 17 })
    L.control.zoom({ position: 'topleft' }).addTo(map)
    map.setView([office.lat, office.lng], 13)
    new BaseLayer().addTo(map)
    const detachLabels = attachLabels(map)
    api.current = {}

    const h = pinNode('home', 'Rumah', '')
    const o = pinNode('office', 'Kantor', '')
    const c = carNode('#22d3ee')
    const mk = (node, anchor) => L.marker([0, 0], { icon: L.divIcon({ html: node.root, className: 'mwrap', iconSize: [0, 0], iconAnchor: anchor }), keyboard: false, interactive: false })
    const homeM = mk(h, [0, 0]).addTo(map)
    const offM = mk(o, [0, 0]).addTo(map)
    const carM = L.marker([0, 0], { icon: L.divIcon({ html: c.root, className: 'mwrap', iconSize: [0, 0], iconAnchor: [0, 0] }), keyboard: false, interactive: false, zIndexOffset: 1000 }).addTo(map)
    const base = L.polyline([], { color: '#ffffff', weight: 13, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map)
    const line = L.polyline([], { color: '#6d4aff', weight: 7, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(map)
    const dash = L.polyline([], { color: '#e8ecff', weight: 2, opacity: 0.7, dashArray: '8 10', lineCap: 'butt' }).addTo(map)
    const done = L.polyline([], { color: '#22d3ee', weight: 8, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map)
    if (location.hostname === 'localhost') window.__mapapi = api
    api.current = { ...api.current, map, h, o, c, homeM, offM, carM, base, line, dash, done }

    const t = setTimeout(() => { map.invalidateSize(); onReady?.() }, 350)
    let raf = 0
    let last = performance.now()
    let lastCount = 0
    let counts = ''
    let night = null
    let lastFollow = false
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const L0 = live.current
      const A = api.current
      playback.tick(dt, L0.tl.total)
      const st = L0.tl.stateAt(playback.progress)
      const gaps = A.tracks
      if (!gaps) return

      const em = playback.real ? playback.realMin : st.minute
      const dark = em < 345 || em > 1095
      if (dark !== night) {
        night = dark
        host.current?.classList.toggle('night', dark)
      }

      if (L0.mode === 'tim') {
        A.carM.getElement()?.style.setProperty('display', 'none')
        A.done.setLatLngs([])
        if (now - lastCount > 250) {
          lastCount = now
          let inOff = 0, road = 0, wfh = 0
          L0.crew.forEach((m) => {
            const s = statusAt(m.model, st.minute, m)
            if (s.loc === 'jalan') road++
            else if (s.loc === 'wfh') wfh++
            else if (s.loc !== 'rumah') inOff++
          })
          const txt = `${inOff} di kantor · ${road} di jalan · ${wfh} WFH`
          if (txt !== counts) { counts = txt; A.o.sub.textContent = txt }
        }
        return
      }

      const ms = L0.model.stateAt(playback.progress)
      const track = ms.path === 'back' ? gaps.back : gaps.out
      const p = track.at(ms.u)
      const carEl = A.carM.getElement()
      const wfh = L0.model.wfh
      if (carEl) carEl.style.display = wfh ? 'none' : ''
      if (!wfh) {
        A.carM.setLatLng([p.lat, p.lng])
        A.c.inner.style.transform = `rotate(${p.heading.toFixed(1)}deg)`
        A.c.root.classList.toggle('parked', !ms.driving)
        A.done.setLatLngs(ms.driving ? track.upTo(ms.u) : [])
        
      } else {
        A.done.setLatLngs([])
      }
      const txt = phaseText(L0.model, ms)
      const where = wfh || ms.kind === 'pre' || ms.kind === 'post' ? A.h : ms.atOffice ? A.o : null
      if (A.lastTxt !== txt || A.lastWhere !== where) {
        A.lastTxt = txt
        A.lastWhere = where
        A.h.sub.textContent = A.idleH || ''
        A.o.sub.textContent = A.idleO || ''
        if (where) where.sub.textContent = txt
        A.h.root.classList.toggle('on', where === A.h)
        A.o.root.classList.toggle('on', where === A.o)
      }
      const follow = L0.follow && ms.driving
      if (follow) {
        A.map.setView([p.lat, p.lng], Math.max(A.map.getZoom(), 15), { animate: false })
      } else if (lastFollow && !L0.follow) {
        A.refit?.()
      }
      lastFollow = follow
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
      detachLabels()
      map.remove()
      api.current = {}
    }
  }, [])

  useEffect(() => {
    let alive = true
    const apply = (pts, real) => {
      const A = api.current
      if (!alive || !A.map) return
      const out = makeTrack(pts)
      A.tracks = { out, back: out.reversed() }
      A.base.setLatLngs(pts)
      A.line.setLatLngs(pts)
      A.dash.setLatLngs(pts)
      A.homeM.setLatLng([home.lat, home.lng])
      A.offM.setLatLng([office.lat, office.lng])
      A.idleH = home.label.split(',')[0].trim()
      A.idleO = office.label.split(',')[0].trim()
      A.lastTxt = null
      A.h.root.title = home.label
      A.o.root.title = office.label
      setApprox(!real)
      setOutside(!(inCover(home) && inCover(office)))
      A.refit = () => {
        const m = live.current
        const wide = window.innerWidth > 820
        A.map.invalidateSize()
        const fit = m.mode === 'tim'
          ? [[office.lat, office.lng], [home.lat, home.lng], ...m.crew.filter((c) => c.home).map((c) => [c.home.lat, c.home.lng])]
          : pts
        A.map.fitBounds(L.latLngBounds(fit), {
          paddingTopLeft: [60, wide ? 310 : 300],
          paddingBottomRight: [(wide ? m.inset : 0) + 60, 150],
          animate: false,
          maxZoom: m.mode === 'tim' ? 13 : 16,
        })
      }
      A.refit()
    }
    const cached = cachedGeometry(home, office)
    apply(cached || straight(home, office), !!cached)
    if (!cached) {
      fetchGeometry(home, office).then((pts) => { if (pts && alive) apply(pts, true) })
    }
    return () => { alive = false }
  }, [home.lat, home.lng, office.lat, office.lng])

  useEffect(() => {
    if (api.current.map) api.current.lastTxt = null
    api.current.refit?.()
  }, [mode, inset])

  useEffect(() => {
    const A = api.current
    if (!A.map) return undefined
    const tim = mode === 'tim'
    A.base.setStyle({ opacity: tim ? 0 : 0.95 })
    A.line.setStyle({ opacity: tim ? 0 : 0.85 })
    A.dash.setStyle({ opacity: tim ? 0 : 0.7 })
    const hm = A.homeM.getElement()
    if (hm) hm.style.display = tim ? 'none' : ''
    if (!tim) return undefined
    const g = L.layerGroup().addTo(A.map)
    const list = [{ id: 'me', name: 'Kamu', color: accent, home }].concat(crew.filter((c) => c.id !== 'me' && c.home))
    list.forEach((m) => {
      const node = el('div', 'mhome')
      node.style.setProperty('--c', m.color || '#94a3b8')
      node.textContent = (m.name || '?').slice(0, 1)
      node.title = `${m.name} · ${m.home.label}`
      L.marker([m.home.lat, m.home.lng], { icon: L.divIcon({ html: node, className: 'mwrap', iconSize: [0, 0] }), interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(g)
    })
    A.refit?.()
    return () => g.remove()
  }, [mode, crew, home.lat, home.lng, accent])

  useEffect(() => {
    api.current.c?.root.style.setProperty('--c', accent)
    api.current.done?.setStyle({ color: accent })
  }, [accent])

  return (
    <div className="mapview">
      <div ref={host} className="mapcanvas" />
      {(approx || outside) && mode !== 'tim' && (
        <div className="map-note glass" role="status">
          {outside ? 'Lokasi di luar area peta offline (Jabodetabek). Hanya jalur yang digambar.' : 'Jalur jalan belum tersedia, ditampilkan sebagai garis lurus.'}
        </div>
      )}
    </div>
  )
}
