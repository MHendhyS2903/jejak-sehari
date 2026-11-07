import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { readGLB } from './glb.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { SHtml } from './SHtml.jsx'
import { url } from './models.jsx'
import { playback } from '../../lib/playback.js'
import { paintWorker } from '../../lib/recolor.js'

export const PERSON_SCALE = 0.37
const SIT_DROP = 0
const SIT_FORWARD = 0.12

const CLIP = {
  Walk: 'Walk', Run: 'Run', Idle: 'Idle', SitDown: 'Sitting', SitIdle: 'Sitting', SitTalk: 'Sitting', Clapping: 'Clapping',
}

const q1 = new THREE.Quaternion()
const e1 = new THREE.Euler()
const rot = (bone, x = 0, y = 0, z = 0) => {
  if (!bone) return
  q1.setFromEuler(e1.set(x, y, z))
  bone.quaternion.multiply(q1)
}

const tmpV = new THREE.Vector3()
const cupGeo = new THREE.CylinderGeometry(0.04, 0.032, 0.09, 12)
const cupMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.5 })

export function PersonView({ base, look, drive, scale = PERSON_SCALE, name, labels, selected, marker, onSelect, id, color, scene = 'interior', shadows = true, lite = false }) {
  const gltf = readGLB(url(`people/${base}`))
  const group = useRef()
  const ring = useRef()
  const cupRef = useRef()
  const badgeEl = useRef()
  const cur = useRef({ anim: null, badge: null, sit: 0, frame: 0 })
  const camera = useThree((s) => s.camera)

  const { clone, mixer, actions, bones, driven, saved } = useMemo(() => {
    const clone = SkeletonUtils.clone(gltf.scene)
    paintWorker(clone, look)
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = shadows
        o.frustumCulled = false
        if (lite && ['Eyes', 'Details', 'TieTexture'].includes(o.material.name)) o.visible = false
      }
    })
    const bones = {}
    clone.traverse((o) => {
      if (o.isBone) bones[o.name] = o
    })
    const mixer = new THREE.AnimationMixer(clone)
    const actions = {}
    gltf.animations.forEach((c) => (actions[c.name] = mixer.clipAction(c)))
    const driven = ['LowerArmL', 'LowerArmR', 'PalmL', 'PalmR', 'Head', 'Torso', 'UpperArmR'].map((n) => bones[n]).filter(Boolean)
    const saved = driven.map((b) => b.quaternion.clone())
    return { clone, mixer, actions, bones, driven, saved }
  }, [gltf, look, shadows, lite])

  useEffect(() => {
    cur.current.anim = null
    return () => mixer.stopAllAction()
  }, [mixer])

  useFrame(({ clock }, dtRaw) => {
    const g = group.current
    const dt = Math.min(dtRaw, 0.1)
    const pose = drive(dt)
    if (!pose || !pose.visible) {
      g.visible = false
      return
    }
    g.visible = true
    const c = cur.current
    c.sit += (pose.sit - c.sit) * Math.min(1, dt * 10)
    if (pose.snap) c.sit = pose.sit
    const fw = SIT_FORWARD * c.sit
    g.position.set(pose.x + Math.sin(pose.yaw) * fw, (pose.y || 0) - SIT_DROP * c.sit, pose.z + Math.cos(pose.yaw) * fw)
    g.rotation.y = pose.yaw
    if (ring.current) ring.current.visible = !!(selected || marker)
    const far = g.position.distanceTo(camera.position) > 42

    const clip = CLIP[pose.anim] || 'Idle'
    if (clip !== c.anim && actions[clip]) {
      const next = actions[clip]
      next.reset()
      const once = clip === 'Sitting'
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
      next.clampWhenFinished = true
      next.enabled = true
      if (c.anim && actions[c.anim] && !pose.snap) {
        next.fadeIn(0.3).play()
        actions[c.anim].fadeOut(0.3)
      } else {
        mixer.stopAllAction()
        next.play()
        if (once && pose.snap) next.time = 1
      }
      c.anim = clip
    }
    const moving = clip === 'Walk' || clip === 'Run'
    const base = clip === 'Run' ? 3.3 : 1.45
    mixer.timeScale = moving ? Math.min(2.2, Math.max(0.6, (pose.speed || 1.45) / base)) * playback.speed : playback.speed
    c.frame++
    const farSkip = far && c.frame % 3 !== 0
    driven.forEach((b, i) => b.quaternion.copy(saved[i]))
    if (!farSkip) mixer.update(playback.playing || pose.snap ? dt * (far ? 3 : 1) : 0)
    driven.forEach((b, i) => saved[i].copy(b.quaternion))

    const t = clock.elapsedTime + (id?.length || 0) * 1.7
    const fx = pose.fx
    if (fx === 'typing' && c.sit > 0.8) {
      const k = Math.sin(t * 9) * 0.06
      rot(bones.LowerArmL, k, 0, 0)
      rot(bones.LowerArmR, -k, 0, 0)
      rot(bones.PalmL, Math.sin(t * 13) * 0.08, 0, 0)
      rot(bones.PalmR, Math.sin(t * 11 + 1) * 0.08, 0, 0)
      rot(bones.Head, 0.12, 0, 0)
    } else if (fx === 'meeting' && c.sit > 0.8) {
      const nod = Math.max(0, Math.sin(t * 2.2)) * 0.12
      rot(bones.Head, nod, pose.look || 0, 0)
      rot(bones.Torso, 0, (pose.look || 0) * 0.5, 0)
    } else if (fx === 'talk' || fx === 'call') {
      rot(bones.Head, Math.sin(t * 1.7) * 0.05, Math.sin(t * 0.8) * 0.25, 0)
      rot(bones.UpperArmR, 0, 0, Math.max(0, Math.sin(t * 2.4)) * 0.25)
    } else if (fx === 'coffee') {
      rot(bones.UpperArmR, -0.5, 0, 0)
      rot(bones.LowerArmR, -0.8, 0, 0)
    }
    const cm = cupRef.current
    cm.visible = !!pose.cup
    if (pose.cup && bones.PalmR) {
      clone.updateWorldMatrix(true, true)
      bones.PalmR.getWorldPosition(tmpV)
      g.worldToLocal(tmpV)
      cm.position.set(tmpV.x, tmpV.y + 0.04, tmpV.z)
    }
    if (badgeEl.current && c.badge !== pose.badge) {
      c.badge = pose.badge
      badgeEl.current.dataset.b = pose.badge || ''
    }
  })

  return (
    <group ref={group} visible={false} onClick={(e) => { e.stopPropagation(); onSelect?.(id) }} onPointerOver={() => onSelect && (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <group scale={scale}>
        <primitive object={clone} />
      </group>
      <mesh ref={cupRef} geometry={cupGeo} material={cupMat} visible={false} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} visible={false}>
        <ringGeometry args={[0.5, 0.64, 40]} />
        <meshBasicMaterial color={color || '#22d3ee'} toneMapped={false} />
      </mesh>
      {labels && (
        <SHtml scene={scene} position={[0, 2.1, 0]} center zIndexRange={[18, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`actor-tag ${selected ? 'sel' : ''}`} style={{ '--c': color || '#22d3ee' }}>
            <i />
            {name}
            <span ref={badgeEl} className="badge" data-b="" />
          </div>
        </SHtml>
      )}
    </group>
  )
}
