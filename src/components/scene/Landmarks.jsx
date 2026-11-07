import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SHtml } from './SHtml.jsx'
import { useParts } from './models.jsx'
import { accentColor, glowTexture } from './sky.js'
import { clamp } from '../../lib/time.js'

function Label({ children, y, tone = 'cyan' }) {
  return (
    <SHtml scene="city" position={[0, y, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`tag tag--${tone}`}>{children}</div>
    </SHtml>
  )
}

const wp = new THREE.Vector3()

export function HomePin({ accent, label, labels, top }) {
  const grp = useRef()
  const gem = useRef()
  const ring = useRef()
  const color = accentColor(accent)
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime
    grp.current.getWorldPosition(wp)
    const d = wp.distanceTo(camera.position)
    const k = clamp(d * 0.05, 0.55, 1.5)
    const show = d > 7
    grp.current.visible = show
    if (!show) return
    gem.current.scale.setScalar(k)
    gem.current.position.y = 1.0 * k + Math.sin(t * 2) * 0.1
    gem.current.rotation.y = t * 1.4
    ring.current.scale.setScalar((1 + ((t * 0.6) % 1) * 0.6) * k)
    ring.current.material.opacity = 0.6 * (1 - ((t * 0.6) % 1))
  })
  return (
    <group ref={grp} position={[top.x, top.y + 0.3, top.z]}>
      <mesh ref={gem}>
        <octahedronGeometry args={[0.28, 0]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.8, 0.9, 40]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {labels && (
        <Label y={2.2} tone="cyan">
          <b>Rumah</b>
          <small>{label}</small>
        </Label>
      )}
    </group>
  )
}

export function OfficeGlow({ label, labels, tower }) {
  const parts = useParts('jakarta/building-skyscraper-e')
  const halo = useRef()
  const beam = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    halo.current.opacity = 0.2 + Math.sin(t * 1.8) * 0.06
    beam.current.opacity = 0.14 + Math.sin(t * 1.3) * 0.05
  })
  return (
    <group position={[tower.x, tower.y, tower.z]} rotation={[0, tower.rot, 0]}>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} scale={[tower.s * 1.05, tower.s * tower.sy * 1.01, tower.s * 1.05]}>
          <meshBasicMaterial ref={i === 0 ? halo : undefined} color="#a78bfa" side={THREE.BackSide} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 5]} />
        <meshBasicMaterial map={glowTexture()} color="#a78bfa" transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, tower.h + 3.2, 0]}>
        <cylinderGeometry args={[0.04, 0.6, 6, 20, 1, true]} />
        <meshBasicMaterial ref={beam} color="#a78bfa" transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {labels && (
        <group position={[0, tower.h + 1.2, 0]} rotation={[0, -tower.rot, 0]}>
          <Label y={0} tone="violet">
            <b>Kantor</b>
            <small>{label}</small>
          </Label>
        </group>
      )}
    </group>
  )
}

export function DistrictLabels() {
  const items = [
    [-18, 3.0, -9.5, 'Jakarta Timur'],
    [-16, 0.9, 1.3, 'Jalan Raya'],
    [1, 2.6, 1, 'Bundaran'],
    [14, 6.0, 5.2, 'Koridor Sudirman'],
  ]
  return items.map(([x, y, z, t], i) => (
    <SHtml key={i} scene="city" position={[x, y, z]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div className="district">{t}</div>
    </SHtml>
  ))
}
