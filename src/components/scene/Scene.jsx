import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { buildLayout, buildRoutes, homeStart, variantPaths } from './cityLayout.js'
import { SimContext } from './SimContext.js'
import SkyRig from './SkyRig.jsx'
import City from './City.jsx'
import { Avatar, Trail } from './Avatar.jsx'
import Traffic from './Traffic.jsx'
import Weather from './Weather.jsx'
import CameraRig from './CameraRig.jsx'
import { DistrictLabels, HomePin, OfficeGlow } from './Landmarks.jsx'
import { HomeInterior, OfficeInterior } from './Interior.jsx'
import { CityActor, CrowdScene } from './Actors.jsx'
import { playback } from '../../lib/playback.js'
import { weatherAt } from '../../lib/atmosphere.js'

function SimDriver({ timeline, routes, sim, mode, groups, weather, dayId, rainOn, inset }) {
  useFrame((_, dt) => {
    playback.tick(Math.min(dt, 0.1), timeline.total)
    const st = timeline.stateAt(playback.progress)
    sim.state = st
    sim.minute = st.minute
    sim.envMinute = playback.real ? playback.realMin : st.minute
    sim.uiInset = inset
    const w = weatherAt(sim.envMinute, weather, dayId)
    sim.rain = rainOn ? w.rain : 0
    sim.cloud = w.cloud
    sim.scene = mode === 'tim' ? 'interior' : st.scene
    sim.deskOn.fill(false)
    sim.meetOn = false
    sim.coffeeOn = false
    sim.followPos = null
    if (mode !== 'tim') {
      const path = routes[st.path]
      sim.s = Math.min(1, Math.max(0, st.u)) * path.length
      path.at(sim.s, sim.car)
    }
    groups.city.current.visible = sim.scene === 'city'
    groups.office.current.visible = sim.scene === 'interior'
    groups.home.current.visible = sim.scene === 'home'
    const el = sim.fadeEl || (sim.fadeEl = document.getElementById('scene-fade'))
    if (el) {
      const f = mode === 'tim' ? 0 : st.fade
      const v = f.toFixed(3)
      if (el.dataset.v !== v) {
        el.dataset.v = v
        el.style.opacity = v
      }
    }
  }, -2)
  return null
}

function ShadowThrottle({ every, enabled, sim }) {
  const gl = useThree((s) => s.gl)
  const n = useRef(0)
  const last = useRef('')
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl, every, enabled])
  useFrame(() => {
    if (!enabled) return
    n.current++
    if (n.current % every === 0 || last.current !== sim.scene) {
      gl.shadowMap.needsUpdate = true
      last.current = sim.scene
    }
  })
  return null
}

function DebugHook() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (location.hostname === 'localhost') {
      window.__scene = scene
      window.__cam = camera
      window.__gl = gl
    }
  }, [scene, camera, gl])
  return null
}

function useRefreshRate() {
  const [hz, setHz] = useState(60)
  useEffect(() => {
    let raf = 0
    let n = 0
    let t0 = 0
    const step = (t) => {
      if (!t0) t0 = t
      else if (++n >= 30) {
        setHz((t - t0) / n > 0 ? Math.round(1000 / ((t - t0) / n)) : 60)
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])
  return hz
}

function FrameLimiter({ cap }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!cap) return undefined
    let raf = 0
    let last = 0
    const step = (t) => {
      raf = requestAnimationFrame(step)
      if (t - last >= 1000 / cap - 2) {
        last = t
        invalidate()
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [cap, invalidate])
  return null
}

function Ready({ onReady, groups }) {
  const { gl, scene, camera } = useThree()
  const frames = useRef(0)
  const done = useRef(false)
  useEffect(() => {
    const g = Object.values(groups).map((r) => r.current).filter(Boolean)
    const prev = g.map((o) => o.visible)
    g.forEach((o) => (o.visible = true))
    try {
      gl.compile(scene, camera)
    } catch {
    }
    g.forEach((o, i) => (o.visible = prev[i]))
  }, [])
  useFrame(() => {
    if (done.current) return
    frames.current++
    if (frames.current >= 8) {
      done.current = true
      onReady()
    }
  })
  return null
}

export default function Scene({
  mode, timeline, model, schedule, homeVariant = 0, free, follow, inset, quality, onDecline, onIncline, onReady, crew, selectedId, onSelect, weather = 'cerah',
}) {
  const layout = useMemo(() => buildLayout(!!quality.thin), [quality.thin])
  const baseRoutes = useMemo(() => buildRoutes(), [])
  const routes = useMemo(() => (homeVariant ? { ...baseRoutes, ...variantPaths(homeVariant) } : baseRoutes), [baseRoutes, homeVariant])
  const homeTop = useMemo(() => {
    if (!homeVariant) return layout.homeTop
    const [x, z] = homeStart(homeVariant)
    return { x, z, y: 2.3 }
  }, [layout, homeVariant])
  const groups = { city: useRef(), office: useRef(), home: useRef() }
  const sim = useMemo(() => {
    const car = {}
    routes.out.at(0, car)
    return {
      state: timeline.stateAt(0), minute: timeline.t0, envMinute: timeline.t0, car, s: 0, night: 0, scene: 'city',
      deskOn: new Array(8).fill(false), meetOn: false, coffeeOn: false, followPos: null, followId: null, cityActor: null,
    }
  }, [])
  sim.followId = follow ? (mode === 'tim' ? selectedId : 'me') : null
  const hz = useRefreshRate()
  const q = useMemo(() => ({ ...quality, fpsCap: quality.fpsCap && hz > quality.fpsCap * 1.25 ? quality.fpsCap : 0 }), [quality, hz])
  const [loaded, setLoaded] = useState(false)
  const markReady = () => {
    setLoaded(true)
    onReady?.()
  }
  const homeMode = model.wfh && mode !== 'tim'
  const rateAt = timeline.rateAt
  const officeCrew = useMemo(() => crew.filter((c) => !c.model.wfh), [crew])
  const homeCrew = useMemo(() => crew.filter((c) => c.isMe && c.model.wfh), [crew])

  return (
    <Canvas
      shadows="percentage"
      dpr={q.dpr}
      camera={{ fov: 42, near: 0.1, far: 500, position: [-6, 6, 10] }}
      frameloop={q.fpsCap ? 'demand' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <FrameLimiter cap={q.fpsCap} />
      <PerformanceMonitor bounds={(hz) => [46, hz > 90 ? 100 : 58]} ms={300} iterations={6} flipflops={4} onDecline={onDecline} onIncline={onIncline} />
      <SimContext.Provider value={sim}>
        <Suspense fallback={null}>
          <SimDriver timeline={timeline} routes={routes} sim={sim} mode={mode} groups={groups} weather={weather} dayId={schedule.activeDay} rainOn={q.rain} inset={inset} />
          <SkyRig shadows={q.shadows} />
          <ShadowThrottle every={q.shadowEvery} enabled={q.shadows} sim={sim} />
          <group ref={groups.city}>
            <City layout={layout} shadows={q.shadows} quality={q} />
            <Avatar accent={schedule.accent} light={q.light} />
            <Trail routes={routes} accent={schedule.accent} />
            <Traffic routes={baseRoutes} layout={layout} quality={q} />
            <Weather />
            <HomePin accent={schedule.accent} label={schedule.home.label} labels={loaded} top={homeTop} />
            <OfficeGlow label={schedule.office.label} labels={loaded} tower={layout.officeTower} />
            {loaded && <DistrictLabels />}
            {mode !== 'tim' && !homeMode && <CityActor routes={routes} me={crew[0]} />}
          </group>
          <group ref={groups.office} visible={false}>
            <OfficeInterior labels={loaded} userDesk={crew[0].desk} officeName={schedule.office.label} lights={q.lights} deskLabel={crew[0].myName ? `Meja ${crew[0].myName}` : undefined} />
            <CrowdScene scene="interior" crew={officeCrew} labels={loaded} selectedId={selectedId} onSelect={onSelect} shadows={q.shadows} markMe rateAt={rateAt} lite={q.lite} />
          </group>
          <group ref={groups.home} visible={false}>
            <HomeInterior labels={loaded} />
            {homeMode && <CrowdScene scene="home" crew={homeCrew} labels={false} shadows={q.shadows} rateAt={rateAt} lite={q.lite} />}
          </group>
          <CameraRig free={free} wfh={model.wfh} inset={inset} follow={follow} />
          {q.bloom && (
            <EffectComposer multisampling={0} enableNormalPass={false}>
              <Bloom intensity={0.85} luminanceThreshold={1.05} luminanceSmoothing={0.25} mipmapBlur radius={0.75} />
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
              <SMAA />
            </EffectComposer>
          )}
          <DebugHook />
          <Ready onReady={markReady} groups={groups} />
        </Suspense>
      </SimContext.Provider>
    </Canvas>
  )
}
