import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { InstancedModel } from './models.jsx'
import { SHtml } from './SHtml.jsx'
import { CLUSTERS, FLOOR, OFFICE, HOME } from '../../data/layouts.js'
import { HOME_PAINT, OFFICE_PAINT } from '../../lib/recolor.js'
import { useSim } from './SimContext.js'
import { h01 } from '../../lib/hash.js'

const SC = 2
const O = (n) => `office/${n}`
const FIX = {}

function add(map, name, x, z, rot = 0, y = 0, extra = {}) {
  ;(map[name] ||= []).push({ x, y, z, rot: rot + (FIX[name] || 0), s: SC, ...extra })
}

function useBuild(build) {
  return useMemo(() => {
    const m = {}
    build(m)
    return m
  }, [])
}

function Models({ map, paintSet }) {
  return Object.entries(map).map(([name, items]) => (
    <InstancedModel key={name} name={O(name)} items={items} cast receive paint={paintSet[name]} />
  ))
}

function gridTexture(base, line, size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  g.strokeStyle = line
  g.lineWidth = 3
  g.strokeRect(0, 0, size, size)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function windowTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, 64, 128)
  for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) {
    if (Math.random() < 0.55) {
      g.fillStyle = Math.random() < 0.8 ? '#ffe1a8' : '#cfe6ff'
      g.fillRect(x, y, 4, 4)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function slideTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 288
  const g = c.getContext('2d')
  const bg = g.createLinearGradient(0, 0, 512, 288)
  bg.addColorStop(0, '#0f2547')
  bg.addColorStop(1, '#1c4a86')
  g.fillStyle = bg
  g.fillRect(0, 0, 512, 288)
  g.fillStyle = '#fff'
  g.font = '700 30px "Plus Jakarta Sans", sans-serif'
  g.fillText('Review Kuartal', 28, 56)
  g.fillStyle = '#9cc4ff'
  g.font = '500 18px "Plus Jakarta Sans", sans-serif'
  g.fillText('Target vs capaian', 28, 84)
  const bars = [0.5, 0.72, 0.6, 0.9, 0.78, 1]
  bars.forEach((v, i) => {
    g.fillStyle = i === 5 ? '#34d399' : '#60a5fa'
    g.fillRect(40 + i * 72, 260 - v * 140, 46, v * 140)
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function textTexture(text, color = '#ffffff') {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')
  g.clearRect(0, 0, 1024, 256)
  g.fillStyle = color
  let size = 120
  g.font = `800 ${size}px "Plus Jakarta Sans", sans-serif`
  while (g.measureText(text).width > 960 && size > 30) {
    size -= 6
    g.font = `800 ${size}px "Plus Jakarta Sans", sans-serif`
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 512, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const mat = (color, extra = {}) => <meshStandardMaterial color={color} roughness={0.7} {...extra} />

function Box({ p, s, color, ...rest }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      {mat(color, rest)}
    </mesh>
  )
}

const glassMat = { color: '#BFD9F2', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false }

function GlassPanel({ p, s, rotY = 0 }) {
  return (
    <mesh position={p} rotation={[0, rotY, 0]}>
      <boxGeometry args={s} />
      <meshStandardMaterial {...glassMat} />
    </mesh>
  )
}

function Screens({ spots }) {
  const sim = useSim()
  const ref = useRef()
  const on = useMemo(() => new THREE.Color(0.35, 1.3, 2.1), [])
  const off = useMemo(() => new THREE.Color(0.02, 0.025, 0.035), [])
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    spots.forEach((s, i) => {
      o.position.set(s.x, s.y, s.z)
      o.rotation.set(-0.08, s.rot, 0)
      o.updateMatrix()
      ref.current.setMatrixAt(i, o.matrix)
      ref.current.setColorAt(i, off)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [spots, off])
  const prev = useRef([])
  useFrame(() => {
    let dirty = false
    spots.forEach((s, i) => {
      const v = !!sim.deskOn?.[s.index]
      if (prev.current[i] !== v) {
        prev.current[i] = v
        ref.current.setColorAt(i, v ? on : off)
        dirty = true
      }
    })
    if (dirty) ref.current.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} frustumCulled={false}>
      <planeGeometry args={[0.62, 0.36]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

function Tv({ x, y, z }) {
  const sim = useSim()
  const mesh = useRef()
  const tex = useMemo(() => slideTexture(), [])
  useFrame(() => {
    const on = sim.meetOn
    mesh.current.material.color.setScalar(on ? 1.5 : 0.03)
  })
  return (
    <mesh ref={mesh} position={[x, y, z]}>
      <planeGeometry args={[1.18, 0.66]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

function CeilingPanels({ spots }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    spots.forEach(([x, z], i) => {
      o.position.set(x, 3.4, z)
      o.updateMatrix()
      ref.current.setMatrixAt(i, o.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [spots])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} frustumCulled={false}>
      <boxGeometry args={[0.8, 0.04, 0.8]} />
      <meshBasicMaterial color={[1.5, 1.6, 1.8]} toneMapped={false} />
    </instancedMesh>
  )
}

function Lights({ count = 4 }) {
  const sim = useSim()
  const refs = useRef([])
  useFrame(() => {
    const n = sim.night ?? 0
    refs.current.forEach((l) => l && (l.intensity = 12 + n * 26))
  })
  const spots = [[-3, 4.2, 0], [9, 4.2, 0], [9, 4.2, -5.5], [-3, 4.2, 6.5]].slice(0, count)
  return spots.map(([x, y, z], i) => (
    <pointLight key={i} ref={(l) => (refs.current[i] = l)} position={[x, y, z]} color="#EAF2FF" distance={16} decay={1.6} />
  ))
}

function Skyline() {
  const sim = useSim()
  const ref = useRef()
  const win = useMemo(() => windowTexture(), [])
  const spots = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const x = -70 + i * 3.1 + h01(i, 1) * 2
        const h = 8 + h01(i, 2) * 34
        const w = 3 + h01(i, 3) * 3
        const z = -16 - h01(i, 4) * 30
        return { x, z, h, w, tint: 0.22 + h01(i, 5) * 0.18 }
      }),
    [],
  )
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    spots.forEach((s, i) => {
      o.position.set(s.x, s.h / 2 - 0.5, s.z)
      o.scale.set(s.w, s.h, s.w)
      o.updateMatrix()
      ref.current.setMatrixAt(i, o.matrix)
      ref.current.setColorAt(i, c.setRGB(s.tint * 0.8, s.tint * 0.95, s.tint * 1.25))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
  }, [spots])
  useFrame(() => {
    ref.current.material.emissiveIntensity = (sim.night ?? 0) * 1.4
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.9} emissive="#ffffff" emissiveMap={win} emissiveIntensity={0} />
    </instancedMesh>
  )
}

function Pill({ x, y, z, children, tone, scene = 'interior' }) {
  return (
    <SHtml scene={scene} position={[x, y, z]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`zone-tag ${tone || ''}`}>{children}</div>
    </SHtml>
  )
}

export function OfficeInterior({ labels, userDesk = 6, officeName = 'Kantor', lights = 4, deskLabel = 'Meja kamu' }) {
  const m = useBuild((m) => {
    const L = OFFICE
    L.desks.forEach((d, i) => {
      const [dx, dz] = d.desk
      const north = d.yaw === 0
      const face = north ? Math.PI : 0
      add(m, 'desk', dx, dz, face)
      add(m, 'computerKeyboard', dx, dz + (north ? -0.14 : 0.14), face, 0.76)
      add(m, 'computerMouse', dx + 0.42, dz + (north ? -0.12 : 0.12), face, 0.76)
      add(m, 'computerScreen', dx, dz + (north ? 0.12 : -0.12), face, 0.76)
      add(m, 'chairDesk', d.seat[0], d.seat[1] + (north ? -0.1 : 0.1), north ? 0 : Math.PI)
      if (i % 2 === 0) add(m, 'trashcan', dx - 0.65, dz + (north ? 0.1 : -0.1), 0)
      if (i % 5 === 1) add(m, 'books', dx - 0.5, dz + (north ? 0.1 : -0.1), 0.3, 0.76)
      if (i % 7 === 3) add(m, 'cardboardBoxClosed', dx + 0.8, dz + (north ? -0.9 : 0.9), 0.4)
    })
    CLUSTERS.forEach(([cx, cz]) => {
      add(m, 'pottedPlant', cx + 1.95, cz, 0, 0, { s: 2.2 })
    })
    add(m, 'deskCorner', -11.0, 2.5, Math.PI / 2)
    add(m, 'pottedPlant', -12.3, 0.6, 0, 0, { s: 2.8 })
    add(m, 'pottedPlant', -12.3, 8.2, 0, 0, { s: 2.4 })
    add(m, 'coatRackStanding', -12.4, 4.4)
    add(m, 'doorwayOpen', -12.97, 6.5, Math.PI / 2)
    ;[-6.2, -4.6, -3.0].forEach((z) => add(m, 'bookcaseClosedWide', -12.55, z, Math.PI / 2))
    add(m, 'books', -12.5, -6.2, 0, 1.6)
    add(m, 'table', 2.6, -8.3, 0)
    ;[6.82, 8.5, 10.18].forEach((x) => add(m, 'tableGlass', x, 4.2, 0))
    const chairAt = (name, s) => add(m, name, s.seat[0] - Math.sin(s.yaw) * 0.1, s.seat[1] - Math.cos(s.yaw) * 0.1, s.yaw)
    L.meet.forEach((s) => chairAt('chairModernCushion', s))
    add(m, 'speakerSmall', 8.5, 4.2, 0, 0.66)
    add(m, 'televisionModern', 8.5, 0.12, 0, 0.7, { s: 2.6 })
    add(m, 'pottedPlant', 12.3, 0.8, 0, 0, { s: 2.4 })
    add(m, 'pottedPlant', 12.3, 8.2, 0, 0, { s: 2.4 })
    const run = [
      ['kitchenFridge', -8.57],
      ['kitchenCabinet', -7.7],
      ['kitchenSink', -6.84],
      ['kitchenCabinet', -5.98],
      ['kitchenCabinet', -5.12],
      ['kitchenCabinet', -4.26],
      ['kitchenCabinet', -3.4],
    ]
    run.forEach(([n, z]) => add(m, n, 5.47, z, Math.PI / 2))
    ;[-7.7, -6.84, -5.98].forEach((z) => add(m, 'kitchenCabinetUpper', 5.23, z, Math.PI / 2, 1.5))
    add(m, 'kitchenMicrowave', 5.4, -5.98, Math.PI / 2, 0.9)
    add(m, 'kitchenCoffeeMachine', 5.4, -5.12, Math.PI / 2, 0.9)
    ;[8.43, 9.29, 10.15].forEach((x) => add(m, 'kitchenBar', x, -8.55, 0))
    add(m, 'kitchenBarEnd', 10.78, -8.55, 0)
    L.bar.forEach((s) => add(m, 'stoolBar', s.seat[0], s.seat[1], Math.PI))
    ;[8.6, 11.8].forEach((x) => add(m, 'tableRound', x, -4.0, 0))
    L.pantryTables.forEach((s) => chairAt('chair', s))
    add(m, 'rugRectangle', -2.0, 6.7, 0)
    add(m, 'loungeDesignSofa', -2.0, 8.3, Math.PI)
    add(m, 'loungeChair', -0.1, 6.3, -Math.PI / 2)
    add(m, 'tableCoffeeGlass', -2.0, 5.9, 0)
    add(m, 'plantSmall1', -2.2, 5.9, 0, 0.46)
    add(m, 'plantSmall2', 0.6, 7.6, 0, 0)
    add(m, 'plantSmall3', -4.3, 8.4, 0, 0)
    add(m, 'pottedPlant', -4.4, 8.3, 0, 0, { s: 2.2 })
  })

  const screens = useMemo(
    () =>
      OFFICE.desks.map((d, i) => {
        const north = d.yaw === 0
        return { x: d.desk[0], y: 1.08, z: d.desk[1] + (north ? 0.2 : -0.2), rot: north ? 0 : Math.PI, index: i }
      }),
    [],
  )
  const ceiling = useMemo(
    () => [
      ...[-9, -5.5, -2, 1.5].flatMap((x) => [-7, -3.2, 0.6].map((z) => [x, z])),
      ...[6.5, 10.5].flatMap((x) => [2.4, 6.2].map((z) => [x, z])),
      ...[7.5, 11].flatMap((x) => [-7, -4.2].map((z) => [x, z])),
      [-3, 6.5],
      [-6.5, 5],
    ],
    [],
  )
  const carpet = useMemo(() => {
    const t = gridTexture('#4B5563', '#5b6676')
    t.repeat.set(13, 9)
    return t
  }, [])
  const vinyl = useMemo(() => {
    const t = gridTexture('#D7DBE1', '#C3C8D0')
    t.repeat.set(4, 3.5)
    return t
  }, [])
  const wallText = useMemo(() => (officeName.split(',')[0].replace(/\s*\([^)]*\)/g, '').trim() || 'Kantor').toUpperCase(), [officeName])
  const brand = useMemo(() => textTexture(wallText), [wallText])
  const sh = useMemo(() => textTexture(wallText, '#0b1d38'), [wallText])

  const mullions = useMemo(() => Array.from({ length: 14 }, (_, i) => -13 + i * 2), [])
  const W = FLOOR.x1 - FLOOR.x0
  const D = FLOOR.z1 - FLOOR.z0
  return (
    <group>
      <Box p={[0, -0.2, 0]} s={[W + 0.4, 0.4, D + 0.4]} color="#2A303A" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={carpet} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, 0.012, -5.5]} receiveShadow>
        <planeGeometry args={[8, 7]} />
        <meshStandardMaterial map={vinyl} roughness={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-11, 0.012, 5]} receiveShadow>
        <planeGeometry args={[4, 8]} />
        <meshStandardMaterial map={vinyl} roughness={0.35} />
      </mesh>

      <GlassPanel p={[0, 1.6, -9.05]} s={[26, 3.2, 0.04]} />
      {mullions.map((x) => <Box key={x} p={[x, 1.6, -9.05]} s={[0.08, 3.2, 0.1]} color="#59616B" />)}
      <Box p={[0, 3.22, -9.05]} s={[26.2, 0.1, 0.14]} color="#59616B" />
      <Skyline />

      <Box p={[-13.1, 1.6, -1.45]} s={[0.2, 3.2, 15.1]} color="#1F3A5F" />
      <Box p={[-13.1, 1.6, 7.9]} s={[0.2, 3.2, 2.2]} color="#1F3A5F" />
      <Box p={[-13.1, 2.7, 6.5]} s={[0.2, 1.0, 1.2]} color="#1F3A5F" />
      <mesh position={[-12.97, 2.3, -4.9]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[6.2, 1.55]} />
        <meshBasicMaterial map={sh} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[-12.94, 2.32, -4.9]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[6.2, 1.55]} />
        <meshBasicMaterial map={brand} transparent toneMapped={false} depthWrite={false} />
      </mesh>

      <GlassPanel p={[4, 1.4, 1.8]} s={[0.05, 2.8, 3.6]} />
      <GlassPanel p={[4, 1.4, 6.85]} s={[0.05, 2.8, 4.3]} />
      <Box p={[4, 2.9, 4.2]} s={[0.1, 0.2, 1.1]} color="#59616B" />
      <Box p={[4, 1.4, 3.6]} s={[0.08, 2.8, 0.06]} color="#59616B" />
      <Box p={[4, 1.4, 4.8]} s={[0.08, 2.8, 0.06]} color="#59616B" />
      <Box p={[4, 1.4, 0]} s={[0.1, 2.8, 0.1]} color="#59616B" />
      <Box p={[8.5, 1.5, -0.05]} s={[9, 3.0, 0.14]} color="#F3F4F6" />
      <Box p={[11.3, 1.45, 0.08]} s={[1.9, 1.15, 0.04]} color="#FFFFFF" />
      <Box p={[11.3, 1.45, 0.06]} s={[2.0, 1.25, 0.03]} color="#9AA3AE" />
      <Tv x={8.5} y={1.2} z={0.2} />
      <Box p={[5.0, 1.5, -6.05]} s={[0.12, 3.0, 5.9]} color="#F3F4F6" />
      <Box p={[5.5, 0.55, -2.6]} s={[0.4, 1.1, 0.4]} color="#E5E7EB" />
      <Box p={[5.5, 1.2, -2.6]} s={[0.3, 0.35, 0.3]} color="#7DD3FC" opacity={0.6} transparent />
      <Box p={[2.6, 1.0, -8.3]} s={[0.8, 0.28, 0.55]} color="#C9CED6" />
      <Box p={[2.6, 0.93, -8.0]} s={[0.55, 0.03, 0.3]} color="#F3F4F6" />

      <Models map={m} paintSet={OFFICE_PAINT} />
      {CLUSTERS.map(([cx, cz]) => (
        <Box key={`${cx}${cz}`} p={[cx, 0.95, cz]} s={[2.95, 0.4, 0.07]} color="#6F7F96" />
      ))}
      <Screens spots={screens} />
      <CeilingPanels spots={ceiling} />
      <Lights count={lights} />

      {labels && (
        <>
          <Pill x={-6} y={3.6} z={-8.6}>Area Kerja</Pill>
          <Pill x={9} y={3.6} z={1.0} tone="violet">Ruang Meeting</Pill>
          <Pill x={9} y={3.6} z={-8.4} tone="amber">Pantry</Pill>
          <Pill x={-2} y={2.4} z={7.1}>Lounge</Pill>
          <Pill x={-6.8} y={2.4} z={OFFICE.desks[userDesk].desk[1] + 0.2} tone="mine">{deskLabel}</Pill>
        </>
      )}
    </group>
  )
}

export function HomeInterior({ labels }) {
  const m = useBuild((m) => {
    const d = HOME.desks[0]
    add(m, 'desk', d.desk[0], d.desk[1], 0)
    add(m, 'chairDesk', d.seat[0], d.seat[1] - 0.1, 0)
    add(m, 'laptop', d.desk[0], d.desk[1] + 0.1, 0, 0.76)
    add(m, 'books', d.desk[0] - 0.6, d.desk[1], 0.2, 0.76)
    add(m, 'loungeDesignSofa', 1.5, 3.6, Math.PI)
    add(m, 'tableCoffeeGlass', 1.5, 1.7, 0)
    add(m, 'rugRectangle', 1.5, 2.2, 0)
    add(m, 'loungeChair', 4.3, 1.8, -Math.PI / 2)
    add(m, 'bookcaseClosedWide', 4.7, -1.4, -Math.PI / 2)
    add(m, 'bookcaseClosedWide', 4.7, -3.0, -Math.PI / 2)
    add(m, 'pottedPlant', -4.3, 3.4, 0, 0, { s: 2.4 })
    add(m, 'pottedPlant', 4.3, -3.6, 0, 0, { s: 2.2 })
    add(m, 'plantSmall1', 1.2, 1.7, 0, 0.46)
  })
  const wood = useMemo(() => {
    const t = gridTexture('#B98E65', '#A47A54', 128)
    t.repeat.set(5, 4)
    return t
  }, [])
  const sim = useSim()
  const screen = useRef()
  useFrame(() => screen.current?.material.color.setRGB(sim.deskOn?.[0] ? 0.35 : 0.02, sim.deskOn?.[0] ? 1.3 : 0.025, sim.deskOn?.[0] ? 2.1 : 0.035))
  useEffect(() => {}, [])
  return (
    <group>
      <Box p={[0, -0.2, 0]} s={[10.4, 0.4, 8.4]} color="#3a2f27" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial map={wood} roughness={0.8} />
      </mesh>
      <Box p={[0, 1.5, -4.1]} s={[10.4, 3.0, 0.2]} color="#EEE8DC" />
      <Box p={[-5.1, 1.5, 0]} s={[0.2, 3.0, 8]} color="#E4DDCF" />
      <mesh position={[0, 1.7, -3.98]}>
        <planeGeometry args={[2.6, 1.5]} />
        <meshStandardMaterial color="#BFD9F2" emissive="#8EC5F5" emissiveIntensity={0.5} />
      </mesh>
      <Models map={m} paintSet={HOME_PAINT} />
      <mesh ref={screen} position={[HOME.desks[0].desk[0], 1.16, HOME.desks[0].desk[1] + 0.28]} rotation={[-0.2, 0, 0]}>
        <planeGeometry args={[0.46, 0.28]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <pointLight position={[0, 3.2, 0]} color="#FFE7C4" intensity={14} distance={14} decay={1.6} />
      {labels && <Pill x={-3.3} y={2.4} z={-3.2} scene="home">Meja kerja rumah</Pill>}
    </group>
  )
}
