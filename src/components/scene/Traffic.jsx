import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useParts } from './models.jsx'
import { cellToWorld } from './cityLayout.js'
import { signalPhase } from './signals.js'
import { bajajGeometry, motorGeometry } from './vehicles.js'
import { useSim } from './SimContext.js'
import { densityAt, jamAt } from '../../lib/atmosphere.js'
import { h01 } from '../../lib/hash.js'

const M = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const V = new THREE.Vector3()
const S1 = new THREE.Vector3(1, 1, 1)
const UP = new THREE.Vector3(0, 1, 0)
const COL = new THREE.Color()
const tmpP = {}

const FIT_CAR = { length: 0.95 }
const FIT_HATCH = { length: 0.92 }
const FIT_BOX = { length: 1.1 }
const FIT_BUS = { length: 1.5, yaw: -Math.PI / 2 }
const FIT_TRAIN = { length: 2.4 }
const BUS_PAINT = { Material: '#1d4ed8', Top: '#e5e7eb', Bottom: '#1d4ed8', Bumper: '#f97316', Details: '#f97316' }
const TRAIN_PAINT = { Outside: '#cfd5dc', Top: '#aab2bb' }
const CAR_COLORS = ['#ffffff', '#d94c4c', '#3b6fd9', '#2f2f33', '#c9ced4', '#e0b13a', '#7a8794', '#1f7a4d']
const CAR_LEN = 0.95

const KINDS = {
  motorGS: { n: 18, len: 0.42, v: [1.7, 2.6], gap: 0.12, motor: { jacket: '#1f9d55', helmet: '#f5f5f5' } },
  motorBS: { n: 14, len: 0.42, v: [1.7, 2.6], gap: 0.12, motor: { jacket: '#20242b', helmet: '#20242b' } },
  motorGP: { n: 8, len: 0.42, v: [1.6, 2.4], gap: 0.12, motor: { jacket: '#1f9d55', helmet: '#e9f7ee', pair: true } },
  motorBP: { n: 7, len: 0.42, v: [1.6, 2.4], gap: 0.12, motor: { jacket: '#394150', helmet: '#394150', pair: true } },
  bajaj: { n: 4, len: 0.62, v: [1.0, 1.4], gap: 0.22 },
  sedan: { n: 8, len: CAR_LEN, v: [1.2, 2.0], gap: 0.26, model: 'jakarta/sedan', color: 'car' },
  suv: { n: 7, len: CAR_LEN, v: [1.2, 1.9], gap: 0.26, model: 'jakarta/suv', color: 'car' },
  hatch: { n: 6, len: 0.92, v: [1.3, 2.1], gap: 0.26, model: 'jakarta/hatchback-sports', color: 'car' },
  taxi: { n: 7, len: CAR_LEN, v: [1.2, 1.9], gap: 0.26, model: 'jakarta/taxi', tint: '#6aa9ff' },
  angkot: { n: 7, len: CAR_LEN, v: [1.0, 1.6], gap: 0.26, model: 'jakarta/van', tint: '#5ec4c4', pause: true },
  delivery: { n: 4, len: 1.1, v: [0.9, 1.5], gap: 0.3, model: 'jakarta/delivery', color: 'car' },
  truck: { n: 3, len: 1.1, v: [0.9, 1.4], gap: 0.3, model: 'jakarta/truck', tint: '#e9edf1' },
  bus: { n: 6, len: 1.5, v: [1.2, 1.6], gap: 0.4, bus: true },
}
const ORDER = Object.keys(KINDS)

const LOOP_WEIGHTS = [3, 3, 2, 2, 2, 2, 2]

function useKindParts(name, paint, fit) {
  const parts = useParts(name || 'jakarta/sedan', paint, fit)
  return parts
}

function KindMeshes({ kind, parts, geo, mat, max, refs, castShadow }) {
  return (
    <>
      {(geo ? [{ geometry: geo, material: mat }] : parts).map((p, i) => (
        <instancedMesh
          key={`${kind}-${i}`}
          ref={(m) => {
            if (m) {
              refs.current[kind] ||= []
              refs.current[kind][i] = m
              m.count = 0
            }
          }}
          args={[p.geometry, p.material, max]}
          castShadow={castShadow}
          frustumCulled={false}
        />
      ))}
    </>
  )
}

const motorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })
const bajajMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })

function ensureColor(m, max) {
  if (!m.instanceColor) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3)
}

export default function Traffic({ routes, layout, quality, avatar }) {
  const sim = useSim()
  const refs = useRef({})
  const total = Math.min(quality.vehicles, 120)

  const sedan = useKindParts('jakarta/sedan', null, FIT_CAR)
  const suv = useKindParts('jakarta/suv', null, FIT_CAR)
  const hatch = useKindParts('jakarta/hatchback-sports', null, FIT_HATCH)
  const taxi = useKindParts('jakarta/taxi', null, FIT_CAR)
  const van = useKindParts('jakarta/van', null, FIT_CAR)
  const delivery = useKindParts('jakarta/delivery', null, FIT_BOX)
  const truck = useKindParts('jakarta/truck', null, FIT_BOX)
  const bus = useKindParts('jakarta/bus', BUS_PAINT, FIT_BUS)
  const partsOf = { sedan, suv, hatch, taxi, angkot: van, delivery, truck, bus }

  const geos = useMemo(
    () => ({
      motorGS: motorGeometry(KINDS.motorGS.motor),
      motorBS: motorGeometry(KINDS.motorBS.motor),
      motorGP: motorGeometry(KINDS.motorGP.motor),
      motorBP: motorGeometry(KINDS.motorBP.motor),
      bajaj: bajajGeometry(),
    }),
    [],
  )

  const fleet = useMemo(() => {
    const vehicles = []
    const loopOrder = []
    LOOP_WEIGHTS.forEach((w, i) => { for (let k = 0; k < w; k++) loopOrder.push(i) })
    const stopsFor = (p) => {
      const stops = []
      const junc = new Set(layout.junctions.map((j) => `${j.c},${j.r}`))
      p.tiles.forEach(([c, r], i) => {
        if (!junc.has(`${c},${r}`)) return
        const prev = p.tiles[(i - 1 + p.tiles.length) % p.tiles.length]
        const axis = prev[1] === r ? 'h' : 'v'
        stops.push({ s: p.tileS[i] - 1.55, axis })
      })
      return stops
    }
    const paths = [...routes.loops, ...routes.buses]
    paths.forEach((p) => (p.stops = p.bus ? [] : stopsFor(p)))
    let idx = 0
    let loopCursor = 0
    ORDER.forEach((kind) => {
      const k = KINDS[kind]
      const n = Math.max(1, Math.round((k.n * total) / 120))
      for (let i = 0; i < n; i++) {
        const seed = idx++
        let path
        if (k.bus) path = routes.buses[i % routes.buses.length]
        else path = routes.loops[loopOrder[loopCursor++ % loopOrder.length]]
        const r = h01(seed, 5)
        vehicles.push({
          kind, path, seed, len: k.len, minGap: k.gap,
          s: h01(seed, 1) * path.length, v0: k.v[0] + (k.v[1] - k.v[0]) * h01(seed, 2), vcur: 0.8,
          rank: (seed * 0.61803) % 1, lat: (h01(seed, 3) - 0.5) * 0.26, motor: kind.startsWith('motor'),
          color: k.tint || CAR_COLORS[Math.floor(h01(seed, 4) * CAR_COLORS.length)], hold: 0, cool: 0, nextPause: 15 + r * 25,
        })
      }
    })
    const byPath = new Map()
    vehicles.forEach((v) => {
      if (!byPath.has(v.path)) byPath.set(v.path, [])
      byPath.get(v.path).push(v)
    })
    return { vehicles, byPath, paths }
  }, [routes, layout, total])

  const t = useRef(0)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    t.current += dt
    const minute = sim.envMinute ?? sim.minute
    const rain = sim.rain || 0
    const jam = jamAt(minute)
    const density = densityAt(minute, rain)
    sim.jam = jam
    sim.density = density
    const speedMul = (1 - 0.68 * jam) * (1 - 0.15 * rain)
    const ph = signalPhase(t.current)
    const ax = sim.car.x
    const az = sim.car.z

    const counts = {}
    ORDER.forEach((k) => (counts[k] = 0))
    for (const [path, arr] of fleet.byPath) {
      const L = path.length
      const act = arr.filter((v) => v.rank < density)
      act.sort((a, b) => a.s - b.s)
      const n = act.length
      for (let i = 0; i < n; i++) {
        const v = act[i]
        const lead = act[(i + 1) % n]
        let vmax = v.v0 * speedMul
        if (n > 1) {
          const gap = ((lead.s - v.s + L) % L) - (lead.len + v.len) * 0.5
          vmax = Math.min(vmax, Math.max(0, gap - v.minGap) * 3.2)
        }
        const front = v.s + v.len * 0.5
        for (const st of path.stops) {
          const d = (st.s - front + L) % L
          const color = ph[st.axis]
          if (d < 2.4 && d > -0.2 && color !== 'green' && !(color === 'yellow' && d < 0.5)) vmax = Math.min(vmax, Math.max(0, d - 0.05) * 2.4)
        }
        if (v.hold > 0) {
          v.hold -= dt
          vmax = 0
        } else if (v.kind === 'angkot') {
          v.nextPause -= dt
          if (v.nextPause <= 0) {
            v.hold = 3.5
            v.nextPause = 18 + h01(v.seed, Math.floor(t.current)) * 25
          }
        }
        if (v.kind === 'bus') {
          v.cool -= dt
          path.at(v.s, tmpP)
          if (v.cool <= 0 && [layoutHalteX(0), layoutHalteX(1)].some((hx) => Math.abs(tmpP.x - hx) < 0.4)) {
            v.hold = 3
            v.cool = 10
          }
        }
        v.vcur += (vmax - v.vcur) * Math.min(1, dt * 4)
        v.s = (v.s + v.vcur * dt + L) % L
      }
      for (let i = 0; i < n; i++) {
        const v = act[i]
        path.at(v.s, tmpP)
        let x = tmpP.x
        let z = tmpP.z
        if (v.motor) {
          const lat = v.lat * (1 + 0.5 * Math.sin(t.current * 0.7 + v.seed))
          x += tmpP.dz * lat
          z -= tmpP.dx * lat
        }
        if (Math.hypot(x - ax, z - az) < 0.8 && !sim.state.atOffice) continue
        const yaw = Math.atan2(tmpP.dx, tmpP.dz)
        Q.setFromAxisAngle(UP, yaw)
        V.set(x, 0.1, z)
        M.compose(V, Q, S1)
        const meshes = refs.current[v.kind]
        if (!meshes) continue
        const ci = counts[v.kind]++
        if (ci >= meshes[0].instanceMatrix.count) continue
        for (const m of meshes) {
          m.setMatrixAt(ci, M)
          if (KINDS[v.kind].color || KINDS[v.kind].tint) {
            ensureColor(m, m.instanceMatrix.count)
            m.setColorAt(ci, COL.set(v.color))
          }
        }
      }
    }
    for (const k of ORDER) {
      const meshes = refs.current[k]
      if (!meshes) continue
      for (const m of meshes) {
        m.count = counts[k]
        m.instanceMatrix.needsUpdate = true
        if (m.instanceColor) m.instanceColor.needsUpdate = true
      }
    }
  })

  return (
    <>
      {ORDER.map((k) => {
        const spec = KINDS[k]
        const max = Math.max(2, Math.ceil((spec.n * total) / 120) + 2)
        if (k.startsWith('motor')) return <KindMeshes key={k} kind={k} geo={geos[k]} mat={motorMat} max={max} refs={refs} castShadow />
        if (k === 'bajaj') return <KindMeshes key={k} kind={k} geo={geos.bajaj} mat={bajajMat} max={max} refs={refs} castShadow />
        return <KindMeshes key={k} kind={k} parts={partsOf[k]} max={max} refs={refs} castShadow={k === 'bus'} />
      })}
      <Train />
    </>
  )
}

const layoutHalteX = (i) => (i === 0 ? cellToWorld(5, 0)[0] + 1 : cellToWorld(17, 0)[0] - 1)

function Train() {
  const parts = useParts('jakarta/train', TRAIN_PAINT, FIT_TRAIN)
  const group = useRef()
  const stripe = useMemo(() => [-2.6, 0, 2.6], [])
  useFrame(({ clock }) => {
    const sp = 3.6
    const cyc = 320
    const u = clock.elapsedTime * sp
    const k = Math.floor(u / cyc)
    const dir = k % 2 ? -1 : 1
    const head = (u % cyc) - 110
    const g = group.current
    g.position.set(dir * head, 3.52, 2)
    g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2
    g.visible = Math.abs(head) < 90
  })
  return (
    <group ref={group}>
      {stripe.map((z) => (
        <group key={z} position={[0, 0, z]}>
          {parts.map((p, i) => (
            <mesh key={i} geometry={p.geometry} material={p.material} castShadow />
          ))}
          <mesh position={[0.36, 0.28, 0]}>
            <boxGeometry args={[0.01, 0.08, 2.35]} />
            <meshStandardMaterial color="#1d4ed8" />
          </mesh>
          <mesh position={[-0.36, 0.28, 0]}>
            <boxGeometry args={[0.01, 0.08, 2.35]} />
            <meshStandardMaterial color="#1d4ed8" />
          </mesh>
        </group>
      ))}
    </group>
  )
}
