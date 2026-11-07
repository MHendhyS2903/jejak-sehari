import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Intro from './components/ui/Intro.jsx'
import Loader, { ErrorBoundary } from './components/ui/Loader.jsx'
import { TeamInsights, TeamStatus, WatchPanel } from './components/ui/TeamPanel.jsx'
import Clock from './components/ui/Clock.jsx'
import TimelineBar from './components/ui/TimelineBar.jsx'
import ScheduleEditor from './components/ui/ScheduleEditor.jsx'
import InsightView from './components/ui/InsightView.jsx'
import SettingsView from './components/ui/SettingsView.jsx'
import Setup from './components/ui/Setup.jsx'
import { AddMemberModal, ShareMeModal, ShareModal } from './components/ui/Modals.jsx'
import { Icon } from './components/ui/icons.jsx'
import { createBlankSchedule, createSampleSchedule } from './data/sample.js'
import { DAYS, fmtTime } from './lib/time.js'
import { cloneEvents, normalizeSchedule } from './lib/schedule.js'
import { buildDay, linearTimeline } from './lib/timeline.js'
import { loadTeam, saveTeam } from './lib/team.js'
import { buildCrew, buildRoster, defaultTravelFor } from './lib/roster.js'
import { ACCENTS } from './components/scene/sky.js'
import { cachedEntry, fetchRoute, makeTravel, offlineEntry } from './lib/estimate.js'
import { dayStats, dayWarnings, departAdvice, weekly } from './lib/insight.js'
import { load, remove, save, storageAvailable } from './lib/storage.js'
import { NORMAL, playback } from './lib/playback.js'
import { webglOk } from './lib/gl.js'
import MapView from './components/map/MapView.jsx'

function ReplayButton() {
  const pb = useSyncExternalStore(playback.subscribe, playback.getSnapshot)
  if (pb.progress < 1 || pb.playing) return null
  return (
    <button className="replay btn primary" onClick={() => { playback.seek(0); playback.play() }}>
      <Icon name="play" size={16} fill /> Putar ulang
    </button>
  )
}

const Scene = memo(lazy(() => import('./components/scene/Scene.jsx')))

const LEVELS = {
  2: { bloom: true, shadows: true, shadowEvery: 2, vehicles: 70, skyline: 36, rain: true, bshadow: true, dpr: [1, 1.5], light: true, lights: 4, fpsCap: 0, lite: false },
  1: { bloom: false, shadows: true, shadowEvery: 5, vehicles: 32, skyline: 20, rain: true, bshadow: false, dpr: 1, light: false, lights: 2, fpsCap: 0, lite: true },
  0: { bloom: false, shadows: false, shadowEvery: 1, vehicles: 8, skyline: 5, thin: true, rain: false, bshadow: false, dpr: 0.8, light: false, lights: 1, fpsCap: 60, lite: true },
}

function initialSchedule() {
  const saved = load('schedule')
  if (saved) {
    try {
      const s = normalizeSchedule(saved)
      s.custom = saved.custom !== false
      return s
    } catch {
    }
  }
  return createSampleSchedule()
}

function initialLevel() {
  const mem = navigator.deviceMemory
  const cores = navigator.hardwareConcurrency || 4
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    if (/swiftshader|llvmpipe|software/i.test(name)) return 0
  } catch {
  }
  if ((mem && mem <= 2) || cores <= 2) return 0
  return 1
}

function useDesktop() {
  const [v, setV] = useState(() => window.innerWidth > 820)
  useEffect(() => {
    const on = () => setV(window.innerWidth > 820)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

function useRoute(home, office) {
  const [entry, setEntry] = useState(() => cachedEntry(home, office) ?? offlineEntry(home, office))
  const [loading, setLoading] = useState(false)
  const run = useCallback(
    (force) => {
      let alive = true
      const cached = force ? null : cachedEntry(home, office)
      setEntry(cached ?? offlineEntry(home, office))
      if (!cached) {
        setLoading(true)
        fetchRoute(home, office).then((r) => {
          if (!alive) return
          if (r) setEntry(r)
          setLoading(false)
        })
      }
      return () => { alive = false }
    },
    [home.lat, home.lng, office.lat, office.lng],
  )
  useEffect(() => run(false), [run])
  return { entry, loading, refresh: () => run(true) }
}

export default function App() {
  const [schedule, setSchedule] = useState(initialSchedule)
  const [ready, setReady] = useState(false)
  const [loaderDone, setLoaderDone] = useState(false)
  const [stage, setStage] = useState('intro')
  const started = stage === 'play'
  const [wantReal, setWantReal] = useState(false)
  const [mode, setMode] = useState('hariku')
  const [team, setTeam] = useState(loadTeam)
  const [weather, setWeather] = useState(() => load('weather') || 'cerah')
  const [selected, setSelected] = useState('me')
  const [watch, setWatch] = useState(null)
  const [follow, setFollow] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 820)
  const [tab, setTab] = useState('jadwal')
  const [sharing, setSharing] = useState(false)
  const [free, setFree] = useState(false)
  const canGL = useMemo(() => webglOk(), [])
  const [view, setView] = useState(() => {
    const v = load('view')
    if (!canGL) return '2d'
    return v === '2d' ? '2d' : '3d'
  })
  const [qMode, setQModeState] = useState(() => {
    const v = load('quality')
    return v === 'tinggi' || v === 'auto' || v === 'rendah' ? v : 'rendah'
  })
  const setQMode = (v) => {
    setQModeState(v)
    save('quality', v)
  }
  const [autoLevel, setAutoLevel] = useState(initialLevel)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => save('schedule', schedule), [schedule])
  useEffect(() => saveTeam(team), [team])
  useEffect(() => save('weather', weather), [weather])
  useEffect(() => {
    if (view !== '2d') return
    const f = document.getElementById('scene-fade')
    if (f) f.style.opacity = 0
  }, [view])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const route = useRoute(schedule.home, schedule.office)
  const travel = useMemo(() => makeTravel(route.entry, schedule.manualMinutes), [route.entry, schedule.manualMinutes])
  const day = schedule.days[schedule.activeDay]
  const dayMeta = DAYS.find((d) => d.id === schedule.activeDay)
  const model = useMemo(() => buildDay(day, travel), [day, travel])
  const teamTL = useMemo(() => linearTimeline(390, 1170, 60), [])
  const tl = mode === 'tim' ? teamTL : model
  const userColor = ACCENTS[schedule.accent] || ACCENTS.cyan
  const userLook = useMemo(() => ({ shirt: userColor, pants: '#1E2A4A', hair: '#0B0B0C', skin: '#C68B59' }), [userColor])
  const roster = useMemo(() => buildRoster(team), [team])
  const crew = useMemo(
    () => buildCrew({ roster, dayId: schedule.activeDay, userModel: model, userLook, travelFor: defaultTravelFor }),
    [roster, schedule.activeDay, model, userLook],
  )
  const watched = mode === 'tim' && watch ? crew.find((c) => c.id === watch) || null : null
  const viewCrew = useMemo(() => {
    if (!watched) return crew
    return [
      { ...watched, id: 'me', isMe: true, myName: watched.name },
      ...crew.filter((c) => c.id !== watched.id).map((c) => (c.id === 'me' ? { ...c, id: 'user', isMe: false } : c)),
    ]
  }, [watched, crew])
  const viewMode = watched ? 'hariku' : mode
  const viewModel = watched ? watched.model : model
  const viewTl = watched ? watched.model : tl
  const viewAccent = watched ? watched.color : userColor
  useEffect(() => { realTl.current = viewTl })
  const sceneSchedule = useMemo(() => (watched ? { ...schedule, accent: watched.color, home: watched.home || schedule.home } : schedule), [schedule, watched])
  const homeVariant = watched ? watched.homeV || 0 : 0
  const stats = useMemo(() => dayStats(model), [model])
  const warnings = useMemo(() => dayWarnings(model), [model])
  const advice = useMemo(() => departAdvice(day, model, travel), [day, model, travel])
  const week = useMemo(() => weekly(schedule, travel), [schedule, travel])

  const desktop = useDesktop()
  const inset = started && panelOpen && desktop ? 404 : 0
  const level = qMode === 'tinggi' ? 2 : qMode === 'rendah' ? 0 : autoLevel
  const quality = LEVELS[level]

  const patchSchedule = (p) => setSchedule((s) => ({ ...s, ...p, custom: true }))
  const setDay = (d) => setSchedule((s) => ({ ...s, custom: true, days: { ...s.days, [s.activeDay]: d } }))
  const copyTo = (ids) => {
    setSchedule((s) => {
      const src = s.days[s.activeDay]
      const days = { ...s.days }
      ids.forEach((id) => { days[id] = { mode: src.mode, events: cloneEvents(src.events) } })
      return { ...s, custom: true, days }
    })
    setToast(`Jadwal disalin ke ${ids.length} hari`)
  }
  const selectDay = (id) => {
    playback.pause()
    playback.seek(0)
    setSchedule((s) => ({ ...s, activeDay: id }))
  }

  const startWatch = (id) => {
    if (id === 'me') {
      switchMode('hariku')
      return
    }
    const target = crew.find((c) => c.id === id)
    if (!target) return
    const minute = teamTL.stateAt(playback.progress).minute
    if (!playback.real) playback.seek(target.model.progressAtMinute(minute))
    setWatch(id)
    setFollow(false)
    setFree(false)
    setSelected(id)
    setTab('watch')
  }
  const stopWatch = () => {
    const minute = watched ? watched.model.stateAt(playback.progress).minute : teamTL.t0
    if (!playback.real) playback.seek(teamTL.progressAtMinute(minute))
    setWatch(null)
    setFollow(false)
    setSelected('me')
    setTab('status')
  }
  useEffect(() => {
    if (watch && mode === 'tim' && !crew.some((c) => c.id === watch)) {
      setWatch(null)
      setTab('status')
    }
  }, [watch, mode, crew])

  const switchMode = (m) => {
    if (m === mode) {
      if (m === 'tim' && watch) stopWatch()
      return
    }
    const minute = viewTl.stateAt(playback.progress).minute
    if (!playback.real) playback.seek((m === 'tim' ? teamTL : model).progressAtMinute(minute))
    setWatch(null)
    setMode(m)
    setFollow(false)
    setSelected('me')
    setTab(m === 'tim' ? 'status' : 'jadwal')
  }
  const pickMember = (id) => {
    if (selected === id && follow) {
      setFollow(false)
      return
    }
    setSelected(id)
    setFollow(true)
  }

  const loadSample = () => {
    playback.pause()
    playback.seek(0)
    setSchedule(createSampleSchedule())
    setTeam([])
    setToast('Data contoh dimuat')
  }
  const reset = () => {
    remove('schedule')
    loadSample()
  }
  const doExport = () => {
    const { custom, ...data } = schedule
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'jadwal-jejak-sehari.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const doImport = async (file) => {
    try {
      const s = normalizeSchedule(JSON.parse(await file.text()))
      playback.pause()
      playback.seek(0)
      setSchedule(s)
      setToast('Jadwal berhasil diimpor')
    } catch (e) {
      setToast(`Gagal impor: ${e.message || 'file tidak valid'}`)
    }
  }

  const openSetup = () => {
    if (!schedule.custom) setSchedule(createBlankSchedule())
    setStage('setup')
  }
  const startPlay = (fromSetup) => {
    if (fromSetup) setSchedule((s) => ({ ...s, custom: true }))
    if (wantReal) {
      const i = (new Date().getDay() + 6) % 7
      if (i < DAYS.length) setSchedule((s) => ({ ...s, activeDay: DAYS[i].id }))
    }
    setStage('play')
    playback.seek(0)
    if (!wantReal) playback.play()
  }
  const playSample = () => {
    setSchedule(createSampleSchedule())
    startPlay(false)
  }
  const fillSample = () => {
    const s = createSampleSchedule()
    setSchedule((cur) => ({ ...s, activeDay: cur.activeDay, accent: cur.accent }))
  }

  const realTl = useRef(null)
  const todayId = () => {
    const i = (new Date().getDay() + 6) % 7
    return i < DAYS.length ? DAYS[i].id : null
  }
  const nowMinute = () => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
  }
  const applyReal = () => {
    playback.setReal(() => realTl.current.progressAtMinute(nowMinute()), nowMinute)
    const m = Math.floor(nowMinute())
    const t = realTl.current
    if (t.t0 != null && (m < t.t0 || m > t.t1)) setToast(`Sekarang ${fmtTime(m, '.')}, di luar rentang hari ini (${fmtTime(t.t0, '.')}–${fmtTime(t.t1, '.')}).`)
  }
  const toggleReal = () => {
    if (playback.real) {
      playback.setReal(null)
      playback.setSpeed(NORMAL)
      return
    }
    const id = todayId()
    if (id && id !== schedule.activeDay) {
      setSchedule((s) => ({ ...s, activeDay: id }))
      setWantReal(true)
      return
    }
    applyReal()
  }
  useEffect(() => {
    if (stage !== 'play' || !wantReal) return
    const id = todayId()
    if (id && id !== schedule.activeDay) return
    setWantReal(false)
    applyReal()
  }, [stage, wantReal, schedule.activeDay])

  const shareData = useMemo(
    () => ({
      dayLabel: dayMeta.label, wfh: model.wfh, stats, model, advice,
      homeLabel: schedule.home.label, officeLabel: schedule.office.label,
    }),
    [dayMeta, model, stats, advice, schedule.home.label, schedule.office.label],
  )

  const travelInfo = model.wfh ? '' : `±${Math.round(model.out.minutes)} mnt berangkat · ±${Math.round(model.back.minutes)} mnt pulang (${model.out.label})`
  const decline = useCallback(() => setAutoLevel((l) => Math.max(0, l - 1)), [])
  const incline = useCallback(() => setAutoLevel((l) => Math.min(2, l + 1)), [])
  const onReady = useCallback(() => setReady(true), [])
  const [err3d, setErr3d] = useState('')
  const fallback2d = useCallback((e) => {
    setErr3d(String((e && e.message) || e || 'tidak diketahui').slice(0, 160))
    setView('2d')
    setToast('Grafis 3D tidak bisa dijalankan di perangkat ini. Beralih ke Peta 2D.')
  }, [])
  const chooseView = (v) => {
    if (v === view) return
    if (v === '3d' && !canGL) {
      setToast('Perangkat ini tidak mendukung WebGL, jadi tampilan 3D tidak tersedia.')
      return
    }
    setFollow(false)
    setFree(false)
    setView(v)
    if (canGL) save('view', v)
  }

  return (
    <div className={`app ${started ? 'started' : ''} ${panelOpen ? '' : 'panel-closed'} view-${view}`}>
      <div className="stage">
        {view === '3d' ? (
          <ErrorBoundary onError={fallback2d}>
            <Suspense fallback={null}>
              <Scene
                mode={viewMode} timeline={viewTl} model={viewModel} schedule={sceneSchedule} homeVariant={homeVariant} free={free} follow={follow} inset={inset}
                quality={quality} weather={weather} onDecline={decline} onIncline={incline} onReady={onReady} crew={viewCrew} selectedId={selected} onSelect={pickMember}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <MapView
            schedule={sceneSchedule} tl={viewTl} model={viewModel} mode={viewMode} crew={viewCrew} follow={follow} inset={inset}
            accent={viewAccent} onReady={onReady}
          />
        )}
      </div>

      <div id="scene-fade" className="scene-fade" />
      {!loaderDone && <Loader ready={ready} onDone={() => setLoaderDone(true)} />}
      {loaderDone && stage === 'intro' && (
        <Intro
          hasSaved={schedule.custom} err3d={err3d} view={view} onView={chooseView} canGL={canGL} real={wantReal} onReal={setWantReal}
          onPlay={() => startPlay(false)} onSetup={openSetup} onSample={playSample}
        />
      )}
      {loaderDone && stage === 'setup' && (
        <Setup
          schedule={schedule} onPatch={patchSchedule} onSetDay={setDay} onCopy={copyTo}
          onSelectDay={(id) => setSchedule((s) => ({ ...s, activeDay: id }))}
          real={wantReal} onReal={setWantReal} onSample={fillSample} onBack={() => setStage('intro')} onPlay={() => startPlay(true)}
        />
      )}

      {started && (
        <>
          <header className="topbar">
            <div className="brand glass"><span className="dot" />Jejak Sehari</div>
            <nav className="days glass" aria-label="Pilih hari">
              {DAYS.map((d) => (
                <button key={d.id} className={schedule.activeDay === d.id ? 'on' : ''} onClick={() => selectDay(d.id)}>
                  {d.short}{schedule.days[d.id].mode === 'wfh' ? <sup>WFH</sup> : null}
                </button>
              ))}
            </nav>
            <div className="viewsw" role="group" aria-label="Jenis tampilan">
              <span className="vs-label">Tampilan</span>
              {[['3d', '3D'], ['2d', 'Peta']].map(([k, l]) => (
                <button key={k} className={view === k ? 'on' : ''} disabled={k === '3d' && !canGL} title={k === '3d' && !canGL ? 'WebGL tidak tersedia di perangkat ini' : undefined} onClick={() => chooseView(k)}>{l}</button>
              ))}
            </div>
            {watched && (
              <div className="watchbar glass" role="status">
                <span>Melihat hari <b>{watched.name}</b></span>
                <button className="btn" onClick={stopWatch}>Kembali ke Tim</button>
              </div>
            )}
            <div className="modes glass" role="group" aria-label="Mode tampilan">
              {[['hariku', 'Hariku'], ['tim', 'Bos View']].map(([k, l]) => (
                <button key={k} className={mode === k ? 'on' : ''} onClick={() => switchMode(k)}>{l}</button>
              ))}
            </div>
          </header>

          <Clock model={viewModel} tl={viewTl} mode={viewMode} weather={weather} dayId={schedule.activeDay} />

          <aside className={`panel glass ${panelOpen ? 'open' : ''}`}>
            <button className="handle" onClick={() => setPanelOpen((v) => !v)} aria-label={panelOpen ? 'Ciutkan panel' : 'Buka panel'} aria-expanded={panelOpen}>
              <Icon name="chevron" size={18} />
              <span className="handle-txt">{panelOpen ? 'Tutup' : 'Jadwal & Insight'}</span>
            </button>
            <div className="tabs" role="tablist">
              {(mode === 'tim' ? (watched ? [['watch', 'Hari ini'], ['atur', 'Pengaturan']] : [['status', 'Status'], ['tinsight', 'Insight tim'], ['atur', 'Pengaturan']]) : [['jadwal', 'Jadwal'], ['insight', 'Insight'], ['atur', 'Pengaturan']]).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
            <div className="panel-body">
              {watched && tab === 'watch' && <WatchPanel member={watched} model={watched.model} dayLabel={dayMeta.label} onBack={stopWatch} />}
              {mode === 'tim' && !watched && tab === 'status' && (
                <TeamStatus members={crew} tl={tl} selectedId={follow ? selected : null} onSelect={pickMember} onWatch={startWatch} onShare={() => setSharing(true)} onAdd={() => setModal('add')} onRemove={(id) => setTeam((t) => t.filter((w) => w.id !== id))} />
              )}
              {mode === 'tim' && tab === 'tinsight' && <TeamInsights members={crew} dayLabel={dayMeta.label} />}
              {mode !== 'tim' && tab === 'jadwal' && (
                <>
                  <h3 className="ptitle">{dayMeta.label}</h3>
                  <ScheduleEditor dayId={schedule.activeDay} day={day} onChange={setDay} onCopy={copyTo} />
                </>
              )}
              {mode !== 'tim' && tab === 'insight' && (
                <InsightView advice={advice} warnings={warnings} stats={stats} week={week} travelInfo={travelInfo} wfh={model.wfh} onShare={() => setModal('share')} />
              )}
              {tab === 'atur' && (
                <SettingsView
                  schedule={schedule} onChange={patchSchedule} route={route} travel={travel} onRefresh={route.refresh}
                  quality={qMode} onQuality={setQMode} view={view} onView={chooseView} canGL={canGL} weather={weather} onWeather={setWeather} storageOk={storageAvailable()}
                  onSample={loadSample} onReset={reset} onExport={doExport} onImport={doImport}
                />
              )}
            </div>
          </aside>

          <TimelineBar view={view} model={viewTl} free={free} onFree={() => setFree((v) => !v)} follow={follow} onFollow={() => { if (viewMode !== 'tim') setSelected('me'); setFollow((v) => !v) }} onReal={toggleReal} />
          {!storageAvailable() && <div className="nostore glass">Mode tanpa penyimpanan</div>}
          <ReplayButton />
        </>
      )}

      {modal === 'add' && <AddMemberModal colorIndex={team.length} onAdd={(w) => { setTeam((t) => [...t, w]); setToast(`${w.name} ditambahkan`) }} onClose={() => setModal(null)} />}
      {sharing && <ShareMeModal person={{ name: 'Saya', role: '', commute: Math.round(model.out?.minutes ?? 40), days: schedule.days }} onClose={() => setSharing(false)} />}
      {modal === 'share' && <ShareModal data={shareData} onClose={() => setModal(null)} />}
      {toast && <div className="toast glass" role="status">{toast}</div>}
    </div>
  )
}
