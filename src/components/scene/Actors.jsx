import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PersonView } from './Person.jsx'
import { useSim } from './SimContext.js'
import { Crowd } from '../../lib/crowd.js'
import { HOME, OFFICE } from '../../data/layouts.js'
import { playback } from '../../lib/playback.js'
import { officePos } from './cityLayout.js'

const layouts = { interior: OFFICE, home: HOME }

export function CrowdScene({ scene, crew, labels, selectedId, onSelect, shadows, markMe, rateAt, lite }) {
  const sim = useSim()
  const crowd = useMemo(() => new Crowd(layouts[scene]), [scene])
  useMemo(() => crowd.set(crew, rateAt), [crowd, crew, rateAt])
  const seen = useRef({ seek: -1 })

  useFrame(() => {
    if (sim.scene !== scene) return
    const snap = seen.current.seek !== playback.seekVersion
    seen.current.seek = playback.seekVersion
    crowd.update(sim.minute, snap)
    for (const [id, it] of crowd.items) {
      const p = it.pose
      if (!p.visible) continue
      if (p.kind === 'seat' && p.seg?.key === 'desk' && p.sit > 0.5) sim.deskOn[it.info.desk] = true
      if (p.kind === 'seat' && p.fx === 'meeting' && p.sit > 0.5) sim.meetOn = true
      if (p.fx === 'coffee' && p.kind === 'stand') sim.coffeeOn = true
      if (id === sim.followId) sim.followPos = [p.x, p.z]
    }
  }, -1)

  return crew.map((a) => (
    <CrowdPerson key={a.id} a={a} crowd={crowd} scene={scene} labels={labels} selected={selectedId === a.id} onSelect={onSelect} shadows={shadows} marker={markMe && a.isMe} sim={sim} lite={lite} />
  ))
}

function CrowdPerson({ a, crowd, scene, labels, selected, onSelect, shadows, marker, sim, lite }) {
  const drive = () => {
    const p = crowd.pose(a.id)
    if (!p || sim.scene !== scene) return null
    const item = a.model.items.find((it) => sim.minute >= it.start && sim.minute < it.end)
    return { ...p, badge: p.visible ? item?.type || '' : '' }
  }
  return (
    <PersonView
      base={a.base} look={a.look} drive={drive} name={a.isMe ? a.myName || 'Kamu' : a.name} labels={labels && (a.isMe || selected)} id={a.id}
      selected={selected} marker={marker} onSelect={onSelect} color={a.color} scene={scene} shadows={shadows} lite={lite}
    />
  )
}

export function CityActor({ routes, me }) {
  const sim = useSim()
  const pts = useMemo(() => {
    const end = routes.out.at(routes.out.length)
    const [ox, oz] = officePos()
    const doorZ = oz + 1.04
    const raw = [
      [end.x - 0.05, end.z - 0.27],
      [end.x - 0.4, doorZ + 0.2],
      [ox - 0.1, doorZ],
    ]
    const cum = [0]
    for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]))
    return { raw, cum, len: cum[cum.length - 1] }
  }, [routes])

  const at = (t) => {
    const s = Math.min(1, Math.max(0, t)) * pts.len
    let i = 1
    while (i < pts.raw.length - 1 && pts.cum[i] < s) i++
    const a = pts.raw[i - 1]
    const b = pts.raw[i]
    const f = (s - pts.cum[i - 1]) / (pts.cum[i] - pts.cum[i - 1] || 1)
    return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, dx: b[0] - a[0], dz: b[1] - a[1] }
  }

  const drive = () => {
    const st = sim.state
    const enter = st.kind === 'enter'
    const exit = st.kind === 'exitout'
    if (!enter && !exit) return null
    const f = st.f
    if ((enter && f < 0.1) || (exit && f > 0.9)) return null
    const t = enter ? (f - 0.1) / 0.9 : 1 - f / 0.9
    const p = at(t)
    const yaw = Math.atan2(exit ? -p.dx : p.dx, exit ? -p.dz : p.dz)
    sim.cityActor = [p.x, p.z]
    return { visible: true, x: p.x, y: 0.1, z: p.z, yaw, anim: 'Walk', once: false, sit: 0, snap: false, speed: 1.45 }
  }

  return <PersonView base={me.base} look={me.look} drive={drive} scale={0.1} scene="city" shadows={false} />
}
