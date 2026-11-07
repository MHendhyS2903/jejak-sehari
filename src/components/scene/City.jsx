import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { InstancedModel, useParts } from './models.jsx'
import { glowTexture } from './sky.js'
import { windowPatch } from './windows.js'
import { useSim } from './SimContext.js'
import {
  AdBoards, Busway, Carts, GlassTowers, Halte, Jpo, Monas, OjekBases, Overpasses, PolesAndCables, Podium, Roofs, ShopSigns, Signals, Skyline,
} from './Scenery.jsx'
import { cellToWorld } from './cityLayout.js'

function Building({ name, items, cast }) {
  const parts = useParts(name)
  const mat = useMemo(() => windowPatch(parts[0].material), [parts])
  return <InstancedModel name={name} items={items} cast={!!cast} receive={!!cast} material={mat} />
}

function Lamps({ lamps }) {
  const bulbs = useRef()
  const glows = useRef()
  const bulbMat = useRef()
  const glowMat = useRef()
  const sim = useSim()
  const pts = useMemo(
    () =>
      lamps.map((l) => {
        const c = Math.cos(l.rot)
        const s = Math.sin(l.rot)
        const lx = -0.2
        return { x: l.x + lx * c, z: l.z - lx * s }
      }),
    [lamps],
  )
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    pts.forEach((p, i) => {
      o.position.set(p.x, 0.97, p.z)
      o.rotation.set(0, 0, 0)
      o.scale.setScalar(1)
      o.updateMatrix()
      bulbs.current.setMatrixAt(i, o.matrix)
      o.position.set(p.x, 0.108, p.z)
      o.rotation.set(-Math.PI / 2, 0, 0)
      o.scale.setScalar(2.6)
      o.updateMatrix()
      glows.current.setMatrixAt(i, o.matrix)
    })
    bulbs.current.instanceMatrix.needsUpdate = true
    glows.current.instanceMatrix.needsUpdate = true
  }, [pts])
  useFrame(() => {
    const n = sim.night ?? 0
    bulbMat.current.color.setRGB(0.4 + n * 3.4, 0.33 + n * 2.0, 0.22 + n * 0.5)
    glowMat.current.opacity = n * 0.55
    glows.current.visible = n > 0.02
  })
  return (
    <>
      <instancedMesh ref={bulbs} args={[undefined, undefined, pts.length]} frustumCulled={false}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshBasicMaterial ref={bulbMat} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glows} args={[undefined, undefined, pts.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={glowMat} map={glowTexture()} color="#ff9a3c" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </instancedMesh>
    </>
  )
}

export default function City({ layout, shadows, quality }) {
  const { roads, base, models, lamps } = layout
  const roadNames = { straight: 'road_straight', crossing: 'road_straight_crossing', corner: 'road_corner', tsplit: 'road_tsplit', junction: 'road_junction' }
  const [plx, plz] = layout.plazaCenter
  const roadMat = useRef()
  void roadMat
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow={shadows}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#2a2f3a" roughness={1} />
      </mesh>
      {Object.entries(roads).map(([k, items]) => (
        <InstancedModel key={k} name={roadNames[k]} items={items} />
      ))}
      <InstancedModel name="base" items={base} />
      {Object.entries(models).map(([name, items]) =>
        name.startsWith('jakarta/building-') ? (
          <Building key={name} name={name} items={items} cast={quality?.bshadow} />
        ) : (
          <InstancedModel key={name} name={name} items={items} cast={name.includes('tree') || name.includes('fountain')} />
        ),
      )}
      <InstancedModel name="streetlight" items={lamps.map((l) => ({ x: l.x, y: 0.1, z: l.z, rot: l.rot }))} cast />
      <Lamps lamps={lamps} />
      <GlassTowers items={layout.glass} cast={quality?.bshadow} />
      <Podium podium={layout.podium} />
      <Busway items={layout.busway} />
      <Halte x={cellToWorld(5, 0)[0] + 1} />
      <Halte x={cellToWorld(17, 0)[0] - 1} />
      <Overpasses />
      <Jpo />
      <PolesAndCables poles={layout.poles} />
      <AdBoards />
      <ShopSigns signs={layout.signs} />
      <Roofs roofs={layout.roofs} />
      <Carts carts={layout.carts} />
      <OjekBases bases={layout.ojek} />
      <Signals signals={layout.signals} />
      <Skyline count={quality?.skyline ?? 70} />
      <Monas />
      <group position={[plx, 0.1, plz]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.2, 0.28, 0.9, 8]} />
          <meshStandardMaterial color="#d8d2c0" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <coneGeometry args={[0.22, 0.8, 6]} />
          <meshStandardMaterial color="#c9a54a" roughness={0.35} metalness={0.7} />
        </mesh>
      </group>
    </group>
  )
}
