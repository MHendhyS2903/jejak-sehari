import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useParts } from './models.jsx'
import { accentColor, glowTexture } from './sky.js'
import { useSim } from './SimContext.js'

export function Avatar({ accent, light: withLight = true }) {
  const sim = useSim()
  const group = useRef()
  const light = useRef()
  const parts = useParts('car_sedan')
  const color = accentColor(accent)
  const bodyMat = useMemo(() => {
    const body = parts.find((p) => p.name === 'car_sedan') || parts[parts.length - 1]
    const m = body.material.clone()
    m.color = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.3)
    m.emissive = new THREE.Color(color)
    m.emissiveIntensity = 0.12
    return { m, body }
  }, [parts, color])

  useFrame(() => {
    const g = group.current
    g.position.set(sim.car.x, 0.13, sim.car.z)
    g.rotation.y = Math.atan2(sim.car.dx, sim.car.dz)
    if (light.current) light.current.intensity = 0.1 + (sim.night ?? 0) * 2.4
  })

  return (
    <group ref={group} scale={1.05}>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={p === bodyMat.body ? bodyMat.m : p.material} castShadow />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[1.5, 2.1]} />
        <meshBasicMaterial map={glowTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.6} />
      </mesh>
      {withLight && <pointLight ref={light} color={color} distance={4.5} decay={2} position={[0, 0.05, 0]} />}
    </group>
  )
}

const N = 40
const STEP = 0.1

export function Trail({ routes, accent }) {
  const sim = useSim()
  const mesh = useRef()
  const alpha = useRef(0)
  const color = useMemo(() => new THREE.Color(accentColor(accent)), [accent])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3))
    const idx = []
    for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    g.setIndex(idx)
    return g
  }, [])
  const tmp = useMemo(() => ({}), [])
  useEffect(() => () => geo.dispose(), [geo])

  useFrame((_, dt) => {
    const want = sim.state.driving ? 1 : 0
    alpha.current += (want - alpha.current) * Math.min(1, dt * 5)
    mesh.current.visible = alpha.current > 0.02
    if (!mesh.current.visible) return
    const path = routes[sim.state.path]
    const pos = geo.attributes.position
    const col = geo.attributes.color
    const k = alpha.current * 1.25
    for (let i = 0; i < N; i++) {
      const s = sim.s - 0.55 - i * STEP
      path.at(Math.max(0, s), tmp)
      const w = 0.1 * (1 - i / N) + 0.012
      const nx = tmp.dz
      const nz = -tmp.dx
      pos.setXYZ(i * 2, tmp.x + nx * w, 0.17, tmp.z + nz * w)
      pos.setXYZ(i * 2 + 1, tmp.x - nx * w, 0.17, tmp.z - nz * w)
      const f = Math.pow(1 - i / N, 1.6) * k
      col.setXYZ(i * 2, color.r * f, color.g * f, color.b * f)
      col.setXYZ(i * 2 + 1, color.r * f, color.g * f, color.b * f)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  })

  return (
    <mesh ref={mesh} geometry={geo} frustumCulled={false}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  )
}
