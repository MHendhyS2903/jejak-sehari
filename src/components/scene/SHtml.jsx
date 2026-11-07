import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSim } from './SimContext.js'

const wp = new THREE.Vector3()

export function SHtml({ scene, children, position = [0, 0, 0], ...props }) {
  const sim = useSim()
  const size = useThree((s) => s.size)
  const g = useRef()
  const ref = useRef()
  useFrame(({ camera }) => {
    const el = ref.current
    if (!el || !g.current) return
    let v = sim.scene === scene
    if (v) {
      g.current.getWorldPosition(wp)
      wp.project(camera)
      const px = (wp.x * 0.5 + 0.5) * size.width
      const py = (-wp.y * 0.5 + 0.5) * size.height
      const inset = sim.uiInset || 0
      if (wp.z > 1 || px > size.width - inset || py > size.height - 96 || py < 0 || px < 0) v = false
    }
    if (el.__v !== v) {
      el.__v = v
      el.style.display = v ? '' : 'none'
    }
  })
  return (
    <group ref={g} position={position}>
      <Html {...props}>
        <div ref={ref}>{children}</div>
      </Html>
    </group>
  )
}
