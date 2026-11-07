import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { officePos } from './cityLayout.js'
import { clamp, smooth } from '../../lib/time.js'
import { HOME, OFFICE } from '../../data/layouts.js'
import { useSim } from './SimContext.js'

const A_POS = new THREE.Vector3()
const A_LOOK = new THREE.Vector3()
const B_POS = new THREE.Vector3()
const B_LOOK = new THREE.Vector3()

export const CAM = {
  home: { off: [3.5, 4.6, 8.5], look: [0.6, 1.0, 0] },
  office: { off: [2, 11, 8.5], look: [-1.1, 1.4, 0.4] },
}

export default function CameraRig({ free, wfh, inset = 0, follow = false }) {
  const sim = useSim()
  const { camera, size } = useThree()
  const controls = useRef()
  const pos = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])
  const sd = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const tp = useMemo(() => new THREE.Vector3(), [])
  const tl = useMemo(() => new THREE.Vector3(), [])
  const init = useRef(false)
  const curInset = useRef(0)
  const lastScene = useRef(null)
  const zoom = useRef(1)

  useEffect(() => {
    if (free) {
      controls.current?.target.copy(look)
      controls.current?.update()
    } else {
      pos.copy(camera.position)
      camera.getWorldDirection(sd)
      look.copy(camera.position).addScaledVector(sd, 10)
      sd.set(sim.car.dx, 0, sim.car.dz)
    }
  }, [free])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    curInset.current += (inset - curInset.current) * (1 - Math.exp(-6 * dt))
    const ins = Math.round(curInset.current)
    if (ins > 0) {
      camera.aspect = (size.width + ins) / size.height
      camera.setViewOffset(size.width + ins, size.height, ins, 0, size.width, size.height)
    } else {
      camera.aspect = size.width / size.height
      camera.clearViewOffset()
    }
    camera.updateProjectionMatrix()
    if (free) return
    const st = sim.state
    const wide = size.width / size.height < 1 ? 1.55 : 1
    let k
    if (sim.scene !== lastScene.current) {
      lastScene.current = sim.scene
      init.current = false
    }
    if (sim.scene === 'interior' || sim.scene === 'home') {
      const L = sim.scene === 'home' ? HOME : OFFICE
      const eff = (size.width - curInset.current) / size.height
      const wideI = Math.min(3, Math.max(1, 1.75 / eff))
      const fp = follow && sim.followPos
      if (fp) {
        tp.set(fp[0] + L.follow[0], L.follow[1], fp[1] + L.follow[2])
        tl.set(fp[0], 0.9, fp[1])
      } else {
        tl.set(L.camera.look[0], L.camera.look[1], L.camera.look[2])
        tp.set(L.camera.pos[0], L.camera.pos[1], L.camera.pos[2])
        tp.sub(tl).multiplyScalar(wideI).add(tl)
      }
      k = 1 - Math.exp(-3 * dt)
    } else if (st.kind === 'enter' || st.kind === 'exitout') {
      const [ax, az] = sim.cityActor || officePos()
      const sc = 1 - 0.2 * st.fade
      tp.set(ax - 1.4 * sc, 1.2 * wide * sc, az + 2.1 * wide * sc)
      tl.set(ax + 0.3, 0.45, az)
      k = 1 - Math.exp(-5 * dt)
    } else if (st.kind === 'pre' && !wfh) {
      const t = smooth(0, 1, st.f)
      A_POS.set(-40, 8.5, 7)
      A_LOOK.set(-2, 9, -44)
      B_POS.set(sim.car.x - 5.4 * wide, 3.5 * wide, sim.car.z)
      B_LOOK.set(sim.car.x + 2.4, 0.4, sim.car.z)
      tp.lerpVectors(A_POS, B_POS, t)
      tp.y += Math.sin(Math.PI * t) * 1.5
      tl.lerpVectors(A_LOOK, B_LOOK, t)
      k = 1 - Math.exp(-6 * dt)
    } else if (st.driving) {
      sd.lerp(tp.set(sim.car.dx, 0, sim.car.dz), 1 - Math.exp(-2.6 * dt)).normalize()
      const fly = 1 - clamp((Math.abs(sim.car.x - 9) - 2) / 5, 0, 1)
      const ring = 1 - clamp((Math.abs(sim.car.x - 1) - 6) / 4, 0, 1)
      const lift = 1.7 * fly + 0.8 * ring
      tp.set(sim.car.x - sd.x * 5.2 * wide, 3.3 * wide + lift, sim.car.z - sd.z * 5.2 * wide)
      tl.set(sim.car.x + sd.x * 2.4, 0.3 + lift * 0.12, sim.car.z + sd.z * 2.4)
      k = 1 - Math.exp(-4.5 * dt)
    } else {
      tp.set(sim.car.x - 3.2 * wide, 2.7 * wide, sim.car.z + 5.2 * wide)
      tl.set(sim.car.x + 0.4, 0.5, sim.car.z)
      k = 1 - Math.exp(-2.2 * dt)
    }
    const ov = typeof window !== 'undefined' && location.hostname === 'localhost' ? window.__camOverride : null
    if (ov) {
      tp.fromArray(ov.pos)
      tl.fromArray(ov.look)
      k = 1
    }
    if (!init.current) {
      pos.copy(tp)
      look.copy(tl)
      init.current = true
    }
    pos.lerp(tp, k)
    look.lerp(tl, k)
    camera.position.copy(pos)
    camera.lookAt(look)
    zoom.current += (1 + st.fade * 0.3 - zoom.current) * (1 - Math.exp(-10 * dt))
    if (Math.abs(camera.zoom - zoom.current) > 0.001) {
      camera.zoom = zoom.current
      camera.updateProjectionMatrix()
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={free}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={3}
      maxDistance={95}
    />
  )
}
