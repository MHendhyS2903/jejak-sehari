import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { InstancedModel, useParts } from './models.jsx'
import { cellToWorld } from './cityLayout.js'
import { windowPatch } from './windows.js'
import { signalPhase } from './signals.js'
import { motorGeometry, roofGeometry, cartGeometry } from './vehicles.js'
import { useSim } from './SimContext.js'
import { h01 } from '../../lib/hash.js'

const tmp = new THREE.Object3D()
const tint = new THREE.Color()

function Inst({ items, children, cast = false, receive = false }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((it, i) => {
      tmp.position.set(it.x, it.y, it.z)
      tmp.rotation.set(it.rx || 0, it.rot || 0, it.rz || 0)
      tmp.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
      if (it.color) m.setColorAt(i, tint.set(it.color))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={cast} receiveShadow={receive} frustumCulled={false}>
      {children}
    </instancedMesh>
  )
}

const std = (color, extra = {}) => <meshStandardMaterial color={color} roughness={0.8} {...extra} />
const bx = <boxGeometry args={[1, 1, 1]} />

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const ADS = [
  ['Kopi Susu', 'Gula Aren', '#3b2417', '#f4d9a8'],
  ['Promo', 'Gajian', '#c0262d', '#ffe66d'],
  ['Apartemen', 'Siap Huni', '#0f3d73', '#9fd3ff'],
  ['Paket Data', 'Murah', '#4c1d95', '#f5d0fe'],
]
function adAtlas() {
  return canvasTex(1024, 512, (g) => {
    ADS.forEach(([a, b, bg, fg], i) => {
      const x = (i % 2) * 512
      const y = Math.floor(i / 2) * 256
      const gr = g.createLinearGradient(x, y, x + 512, y + 256)
      gr.addColorStop(0, bg)
      gr.addColorStop(1, '#00000066')
      g.fillStyle = bg
      g.fillRect(x, y, 512, 256)
      g.fillStyle = gr
      g.fillRect(x, y, 512, 256)
      g.fillStyle = fg
      g.font = '800 64px "Plus Jakarta Sans", sans-serif'
      g.textBaseline = 'middle'
      g.fillText(a, x + 28, y + 96)
      g.font = '800 78px "Plus Jakarta Sans", sans-serif'
      g.fillText(b, x + 28, y + 180)
    })
  })
}

const SIGNS = ['Warung Makan', 'Apotek', 'Toko Kelontong', 'Bengkel Motor', 'Laundry', 'Fotokopi']
const SIGN_COLORS = ['#b3261e', '#0b7a3b', '#1d4e89', '#e07a00', '#0e7490', '#6d28d9']
function signTex(i) {
  return canvasTex(256, 80, (g, w, h) => {
    g.fillStyle = SIGN_COLORS[i]
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#ffffffcc'
    g.lineWidth = 4
    g.strokeRect(5, 5, w - 10, h - 10)
    g.fillStyle = '#fff'
    g.font = '800 30px "Plus Jakarta Sans", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(SIGNS[i], w / 2, h / 2 + 2)
  })
}

export function GlassTowers({ items, cast }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#8fb0cb', roughness: 0.22, metalness: 0.55 })
    return windowPatch(m)
  }, [])
  const list = useMemo(
    () =>
      items.map((g) => ({
        x: g.x, y: 0.1 + g.h / 2, z: g.z, rot: g.rot, sx: g.w, sy: g.h, sz: g.w,
        color: tint.setHSL(0.55 + g.tint * 0.06, 0.3, 0.8 + g.tint * 0.1).getStyle(),
      })),
    [items],
  )
  const tops = useMemo(() => items.map((g) => ({ x: g.x, y: 0.1 + g.h + 0.12, z: g.z, rot: g.rot, sx: g.w * 0.55, sy: 0.24, sz: g.w * 0.55 })), [items])
  return (
    <>
      <Inst items={list} cast={!!cast} receive={!!cast}>
        {bx}
        <primitive object={mat} attach="material" />
      </Inst>
      <Inst items={tops}>
        {bx}
        {std('#6b7280')}
      </Inst>
    </>
  )
}

export function Podium({ podium }) {
  const tex = useMemo(
    () =>
      canvasTex(512, 128, (g, w, h) => {
        g.fillStyle = '#12395f'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#fff'
        g.font = '800 64px "Plus Jakarta Sans", sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('MAL TIMUR', w / 2, h / 2 + 4)
      }),
    [],
  )
  const { x, z, w, d, h } = podium
  const towers = [[4, 3], [5, 3], [6, 3], [4, 4], [6, 4]].map(([c, r]) => cellToWorld(c, r))
  const by = 0.1 + h + 3.3
  return (
    <group>
      <mesh position={[x, 0.1 + h / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        {std('#d9d4c7')}
      </mesh>
      <mesh position={[x, 0.1 + h * 0.62, z + d / 2 + 0.01]}>
        <planeGeometry args={[w * 0.96, h * 0.34]} />
        <meshStandardMaterial color="#6f8fa8" roughness={0.2} metalness={0.5} emissive="#9fd3ff" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[x, 0.1 + h + 0.14, z + d / 2 + 0.02]}>
        <planeGeometry args={[2.4, 0.6]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {[[0, 1, 'x'], [1, 2, 'x'], [0, 3, 'z'], [2, 4, 'z']].map(([a, b, ax], i) => {
        const A = towers[a]
        const B = towers[b]
        return (
          <mesh key={i} position={[(A[0] + B[0]) / 2, by, (A[1] + B[1]) / 2]} castShadow>
            <boxGeometry args={ax === 'x' ? [0.6, 0.34, 0.42] : [0.42, 0.34, 0.6]} />
            {std('#c9ced4', { metalness: 0.3 })}
          </mesh>
        )
      })}
    </group>
  )
}

export function Busway({ items }) {
  const overlay = useMemo(() => items.map((b) => ({ x: b.x, y: 0.108, z: b.z, rot: b.rot, sx: 1.24, sy: 1, sz: 2 })), [items])
  const flat = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [])
  const seps = useMemo(() => {
    const list = []
    const crossX = [3, 7, 15, 19].map((c) => cellToWorld(c, 0)[0])
    for (let x = -43; x <= 43; x += 1.1) {
      if (crossX.some((cx) => Math.abs(x - cx) < 1.25)) continue
      if (x > -4 && x < 6) continue
      list.push({ x, y: 0.17, z: 0.4, sx: 0.55, sy: 0.14, sz: 0.14 }, { x, y: 0.17, z: 1.6, sx: 0.55, sy: 0.14, sz: 0.14 })
    }
    return list
  }, [])
  return (
    <>
      <Inst items={overlay} receive>
        <primitive object={flat} attach="geometry" />
        <meshStandardMaterial color="#9a3b34" roughness={0.9} transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </Inst>
      <Inst items={seps} cast>
        {bx}
        {std('#cfd2d6')}
      </Inst>
    </>
  )
}

export function Halte({ x }) {
  return (
    <group position={[x, 0.1, 0.0]}>
      <mesh position={[0, 0.06, 0.55]} receiveShadow>
        <boxGeometry args={[3.0, 0.12, 0.6]} />
        {std('#b8bdc4')}
      </mesh>
      {[-1.4, -0.7, 0, 0.7, 1.4].map((px) => (
        <mesh key={px} position={[px, 0.75, 0.55]}>
          <boxGeometry args={[0.04, 1.3, 0.04]} />
          {std('#475569')}
        </mesh>
      ))}
      <mesh position={[0, 1.42, 0.55]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1.5]}>
        <cylinderGeometry args={[0.36, 0.36, 3.1, 14, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#9fd3f0" transparent opacity={0.55} roughness={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.7, 0.28]}>
        <boxGeometry args={[2.8, 1.1, 0.02]} />
        <meshStandardMaterial color="#bfe3f5" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.66, 0.55]}>
        <boxGeometry args={[1.0, 0.1, 0.06]} />
        <meshBasicMaterial color="#f97316" toneMapped={false} />
      </mesh>
    </group>
  )
}

const concrete = '#b9bec5'
export function Overpasses() {
  const W = 11.5
  const mrtPillars = useMemo(() => {
    const crossX = [3, 7, 15, 19].map((c) => cellToWorld(c, 0)[0])
    const list = []
    for (let x = -42; x <= 42; x += 3.6) {
      if (crossX.some((cx) => Math.abs(x - cx) < 1.5)) continue
      if (x > -4.3 && x < 6.3) continue
      list.push({ x, y: 1.65, z: 2, sx: 0.34, sy: 3.3, sz: 0.34 })
    }
    return list
  }, [])
  return (
    <group>
      <mesh position={[0, 3.4, 2]} castShadow>
        <boxGeometry args={[96, 0.22, 1.05]} />
        {std(concrete)}
      </mesh>
      {[-0.4, 0.4].map((o) => (
        <mesh key={o} position={[0, 3.55, 2 + o]}>
          <boxGeometry args={[96, 0.05, 0.05]} />
          {std('#4b5563', { metalness: 0.6 })}
        </mesh>
      ))}
      <Inst items={mrtPillars} cast>
        {bx}
        {std(concrete)}
      </Inst>
      <group position={[9, 0, 0]}>
        <mesh position={[0, 1.95, 0]} castShadow>
          <boxGeometry args={[W - 4.2, 0.22, 1.1]} />
          {std('#9ca3af')}
        </mesh>
        <mesh position={[-(W - 4.2) / 2 - 1.55, 1.05, 0]} rotation={[0, 0, Math.atan2(1.8, 3.2)]} castShadow>
          <boxGeometry args={[3.5, 0.22, 1.1]} />
          {std('#9ca3af')}
        </mesh>
        <mesh position={[(W - 4.2) / 2 + 1.55, 1.05, 0]} rotation={[0, 0, -Math.atan2(1.8, 3.2)]} castShadow>
          <boxGeometry args={[3.5, 0.22, 1.1]} />
          {std('#9ca3af')}
        </mesh>
        {[-1.0, 1.0].map((o) => (
          <mesh key={o} position={[0, 2.18, o * 0.5]}>
            <boxGeometry args={[W - 4.2, 0.1, 0.06]} />
            {std('#f5f5f5')}
          </mesh>
        ))}
        {[-1.6, 1.6].map((px) => (
          <mesh key={px} position={[px, 0.95, 0]} castShadow>
            <boxGeometry args={[0.32, 1.9, 0.5]} />
            {std(concrete)}
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function Jpo() {
  const x = cellToWorld(18, 0)[0]
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 1.62, 0.5]} castShadow>
        <boxGeometry args={[0.7, 0.14, 7.6]} />
        {std('#7c8794')}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.34, 1.9, 0.5]}>
          <boxGeometry args={[0.04, 0.42, 7.6]} />
          <meshStandardMaterial color="#b6e0f2" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 2.18, 0.5]} castShadow>
        <boxGeometry args={[0.9, 0.08, 7.8]} />
        {std('#e07a1f')}
      </mesh>
      {[[-3.1], [4.1]].map(([z]) => (
        <mesh key={z} position={[0, 0.88, z]} castShadow>
          <boxGeometry args={[0.5, 1.7, 0.5]} />
          {std('#7c8794')}
        </mesh>
      ))}
      <mesh position={[0, 0.88, -3.3 - 0.75]} rotation={[-Math.atan2(1.5, 1.5), 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.1, 2.1]} />
        {std('#7c8794')}
      </mesh>
      <mesh position={[0, 0.88, 4.3 + 0.75]} rotation={[Math.atan2(1.5, 1.5), 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.1, 2.1]} />
        {std('#7c8794')}
      </mesh>
    </group>
  )
}

export function PolesAndCables({ poles }) {
  const items = useMemo(() => poles.map((p) => ({ x: p.x, y: 1.2, z: p.z, sx: 0.09, sy: 2.4, sz: 0.09 })), [poles])
  const arms = useMemo(() => poles.map((p) => ({ x: p.x, y: 2.3, z: p.z, sx: 0.5, sy: 0.05, sz: 0.05, rot: p.line.startsWith('v') ? Math.PI / 2 : 0 })), [poles])
  const geo = useMemo(() => {
    const byLine = {}
    poles.forEach((p) => (byLine[p.line] ||= []).push(p))
    const pts = []
    Object.values(byLine).forEach((arr) => {
      const vertical = arr[0].line.startsWith('v')
      arr.sort((a, b) => (vertical ? a.z - b.z : a.x - b.x))
      for (let i = 1; i < arr.length; i++) {
        const a = arr[i - 1]
        const b = arr[i]
        const len = Math.hypot(a.x - b.x, a.z - b.z)
        if (len > 4) continue
        for (let k = 0; k < 4; k++) {
          const oy = 2.35 - k * 0.07
          const lat = (k - 1.5) * 0.1
          const sag = 0.1 + h01(k, i, 7) * 0.2
          let prev = null
          for (let j = 0; j <= 8; j++) {
            const t = j / 8
            const x = a.x + (b.x - a.x) * t + (vertical ? lat : 0)
            const z = a.z + (b.z - a.z) * t + (vertical ? 0 : lat)
            const y = oy - Math.sin(Math.PI * t) * sag
            if (prev) pts.push(prev[0], prev[1], prev[2], x, y, z)
            prev = [x, y, z]
          }
        }
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
    return g
  }, [poles])
  return (
    <>
      <Inst items={items} cast>
        <cylinderGeometry args={[1, 1.2, 1, 6]} />
        {std('#8b8f94')}
      </Inst>
      <Inst items={arms}>
        {bx}
        {std('#6b7280')}
      </Inst>
      <lineSegments geometry={geo} frustumCulled={false}>
        <lineBasicMaterial color="#1b1d22" />
      </lineSegments>
    </>
  )
}

const BOARDS = [
  { x: -17, z: 7.2, y: 4.0, rot: Math.PI, slide: 0 },
  { x: -7, z: 6.8, y: 4.0, rot: Math.PI, slide: 1, led: true },
  { x: -19, z: -9.5, y: 3.6, rot: 0, slide: 2 },
  { x: 11.8, z: -8.8, y: 4.6, rot: 0, slide: 3, led: true, big: true },
  { x: 19.5, z: 8.5, y: 6.5, rot: Math.PI, slide: 1, big: true },
  { x: 3.5, z: -9.4, y: 4.0, rot: 0, slide: 0, led: true },
]

function AdBoard({ b, atlas }) {
  const sim = useSim()
  const mat = useRef()
  const tex = useMemo(() => {
    const t = atlas.clone()
    t.needsUpdate = true
    t.repeat.set(0.5, 0.5)
    return t
  }, [atlas])
  const w = b.big ? 3.2 : 2.2
  const h = w / 2
  const setSlide = (i) => tex.offset.set((i % 2) * 0.5, 0.5 - Math.floor(i / 2) * 0.5)
  useLayoutEffect(() => {
    setSlide(b.slide)
  }, [])
  const last = useRef(-1)
  useFrame(({ clock }) => {
    const n = sim.night ?? 0
    if (b.led) {
      const i = (b.slide + Math.floor(clock.elapsedTime / 3.2)) % 4
      if (i !== last.current) {
        last.current = i
        setSlide(i)
      }
      mat.current.color.setScalar(0.75 + n * 1.5)
    } else mat.current.color.setScalar(0.85 + n * 0.25)
  })
  return (
    <group position={[b.x, b.y, b.z]} rotation={[0, b.rot, 0]}>
      <mesh position={[0, 0, -0.06]} castShadow>
        <boxGeometry args={[w + 0.2, h + 0.2, 0.1]} />
        {std('#2a2f38')}
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial ref={mat} map={tex} toneMapped={false} />
      </mesh>
      {[-w * 0.3, w * 0.3].map((px) => (
        <mesh key={px} position={[px, -h / 2 - 0.9, -0.08]}>
          <boxGeometry args={[0.12, 1.8, 0.12]} />
          {std('#4b5563')}
        </mesh>
      ))}
    </group>
  )
}

export function AdBoards() {
  const atlas = useMemo(() => adAtlas(), [])
  return BOARDS.map((b, i) => <AdBoard key={i} b={b} atlas={atlas} />)
}

export function ShopSigns({ signs }) {
  const groups = useMemo(() => {
    const g = Array.from({ length: 6 }, () => [])
    signs.forEach((s) => g[s.type].push({ x: s.x, y: s.y, z: s.z, rot: s.rot, sx: 1, sy: 1, sz: 1 }))
    return g
  }, [signs])
  const texs = useMemo(() => Array.from({ length: 6 }, (_, i) => signTex(i)), [])
  return groups.map((items, i) => (
    <Inst key={i} items={items}>
      <planeGeometry args={[0.95, 0.3]} />
      <meshBasicMaterial map={texs[i]} toneMapped={false} />
    </Inst>
  ))
}

export function Roofs({ roofs }) {
  const items = useMemo(() => roofs.map((r) => ({ x: r.x, y: r.y, z: r.z, rot: r.rot + (r.rot === 0 || Math.abs(r.rot - Math.PI) < 0.01 ? 0 : 0), sx: r.w, sy: 1, sz: r.d, color: r.color })), [roofs])
  const geo = useMemo(() => roofGeometry(), [])
  return (
    <Inst items={items} cast>
      <primitive object={geo} attach="geometry" />
      {std('#ffffff', { side: THREE.DoubleSide })}
    </Inst>
  )
}

export function Carts({ carts }) {
  const items = useMemo(() => carts.map((c) => ({ x: c.x, y: 0.1, z: c.z, rot: c.rot, sx: 1, sy: 1, sz: 1, color: c.color })), [carts])
  const geo = useMemo(() => cartGeometry(), [])
  const parasol = useMemo(() => carts.map((c) => ({ x: c.x, y: 0.1 + 0.55, z: c.z, rot: c.rot, s: 1.5 })), [carts])
  return (
    <>
      <Inst items={items} cast>
        <primitive object={geo} attach="geometry" />
        <meshStandardMaterial vertexColors roughness={0.8} />
      </Inst>
      <InstancedModel name="jakarta/detail-parasol-a" items={parasol} cast />
    </>
  )
}

export function OjekBases({ bases }) {
  const variants = useMemo(
    () => [
      { geo: motorGeometry({ jacket: '#1f9d55', helmet: '#f5f5f5' }), items: [] },
      { geo: motorGeometry({ jacket: '#20242b', helmet: '#20242b' }), items: [] },
      { geo: motorGeometry({ jacket: '#1f9d55', helmet: '#e9f7ee', pair: true }), items: [] },
    ],
    [],
  )
  const list = useMemo(() => {
    const out = variants.map((v) => ({ geo: v.geo, items: [] }))
    bases.forEach((b, bi) => {
      for (let i = 0; i < 3; i++) {
        const k = Math.floor(h01(bi, i, 3) * 3)
        out[k].items.push({
          x: b.x + (i - 1) * 0.72 + (h01(bi, i, 1) - 0.5) * 0.05,
          y: 0.1,
          z: b.z + (h01(bi, i, 4) - 0.5) * 0.05,
          rot: b.rot,
          sx: 1, sy: 1, sz: 1,
        })
      }
    })
    return out
  }, [bases, variants])
  return list.map((v, i) => (
    <Inst key={i} items={v.items} cast>
      <primitive object={v.geo} attach="geometry" />
      <meshStandardMaterial vertexColors roughness={0.7} />
    </Inst>
  ))
}

export function Monas() {
  const flame = useRef()
  useFrame(({ clock }) => flame.current?.scale.setScalar(1 + Math.sin(clock.elapsedTime * 6) * 0.06))
  return (
    <group position={[-2, 0, -58]} scale={1.5}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[7, 0.6, 7]} />
        {std('#e8e4da')}
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[4.4, 1.2, 4.4]} />
        {std('#efece4')}
      </mesh>
      <mesh position={[0, 8.3, 0]}>
        <cylinderGeometry args={[0.16, 0.5, 14.4, 4]} />
        {std('#f5f3ee', { roughness: 0.5 })}
      </mesh>
      <mesh position={[0, 15.6, 0]}>
        <boxGeometry args={[1.5, 0.4, 1.5]} />
        {std('#e7e3d8')}
      </mesh>
      <mesh ref={flame} position={[0, 16.6, 0]}>
        <coneGeometry args={[0.38, 1.5, 8]} />
        <meshBasicMaterial color={[3.2, 2.1, 0.5]} toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}

const LOW = ['a', 'b', 'c', 'd', 'e'].map((l) => `jakarta/low-detail-building-${l}`).concat(['jakarta/low-detail-building-wide-a', 'jakarta/low-detail-building-wide-b'])
function LowBuilding({ name, items }) {
  const parts = useParts(name)
  const mat = useMemo(() => {
    const m = parts[0].material.clone()
    m.color = new THREE.Color('#9fb0c2')
    return windowPatch(m)
  }, [parts])
  return <InstancedModel name={name} items={items} material={mat} />
}
export function Skyline({ count = 70 }) {
  const groups = useMemo(() => {
    const g = LOW.map(() => [])
    for (let i = 0; i < count; i++) {
      const ring = i % 4
      let x
      let z
      if (ring < 2) {
        x = -80 + h01(i, 1) * 160
        z = (ring === 0 ? -1 : 1) * (32 + h01(i, 2) * 26)
      } else {
        z = -30 + h01(i, 3) * 60
        x = (ring === 2 ? -1 : 1) * (46 + h01(i, 4) * 26)
      }
      if (Math.abs(x + 2) < 14 && z < -34 && z > -62) continue
      const k = Math.floor(h01(i, 5) * LOW.length)
      const s = 4 + h01(i, 6) * 5
      g[k].push({ x, y: 0, z, rot: Math.floor(h01(i, 7) * 4) * (Math.PI / 2), s, sy: 0.8 + h01(i, 8) * 1.3 })
    }
    return g
  }, [count])
  return groups.map((items, i) => (items.length ? <LowBuilding key={LOW[i]} name={LOW[i]} items={items} /> : null))
}

export function Signals({ signals }) {
  const sim = useSim()
  const lampH = useRef()
  const poles = useMemo(() => signals.map((s) => ({ x: s.x, y: 0.75, z: s.z, sx: 0.07, sy: 1.5, sz: 0.07 })), [signals])
  const heads = useMemo(() => signals.map((s) => ({ x: s.x, y: 1.55, z: s.z, sx: 0.2, sy: 0.2, sz: 0.2 })), [signals])
  const col = useMemo(() => ({ green: new THREE.Color(0.2, 2.2, 0.6), yellow: new THREE.Color(2.4, 1.7, 0.2), red: new THREE.Color(2.6, 0.2, 0.2) }), [])
  const prev = useRef('')
  useFrame(({ clock }) => {
    const ph = signalPhase(clock.elapsedTime)
    const sig = `${ph.h}${ph.v}`
    if (sig === prev.current || !lampH.current) return
    prev.current = sig
    signals.forEach((s, i) => lampH.current.setColorAt(i, col[ph[s.axis]]))
    lampH.current.instanceColor.needsUpdate = true
  })
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    signals.forEach((s, i) => {
      o.position.set(s.x, 1.62, s.z)
      o.updateMatrix()
      lampH.current.setMatrixAt(i, o.matrix)
      lampH.current.setColorAt(i, col.red)
    })
    lampH.current.instanceMatrix.needsUpdate = true
  }, [signals, col])
  void sim
  return (
    <>
      <Inst items={poles} cast>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        {std('#3a3f46')}
      </Inst>
      <Inst items={heads}>
        {bx}
        {std('#1f2329')}
      </Inst>
      <instancedMesh ref={lampH} args={[undefined, undefined, signals.length]} frustumCulled={false}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  )
}
