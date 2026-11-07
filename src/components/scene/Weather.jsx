import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim } from './SimContext.js'
import { h01 } from '../../lib/hash.js'

const vert = `
  attribute float aSeed;
  uniform float uTime;
  uniform float uRain;
  varying float vA;
  void main() {
    vec3 p = position;
    float fall = mod(aSeed * 40.0 - uTime * 26.0, 40.0);
    p.y = fall - 8.0 + (position.y > 0.5 ? 0.9 : 0.0);
    p.x += (position.y > 0.5 ? 0.12 : 0.0);
    vA = (0.25 + 0.5 * aSeed) * uRain;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const frag = `
  varying float vA;
  void main() { gl_FragColor = vec4(0.78, 0.85, 0.95, vA); }
`

export default function Weather({ enabled = true }) {
  const sim = useSim()
  const group = useRef()
  const wet = useRef()
  const mat = useRef()
  const geo = useMemo(() => {
    const n = 650
    const pos = new Float32Array(n * 6)
    const seed = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      const x = (h01(i, 1) - 0.5) * 50
      const z = (h01(i, 2) - 0.5) * 50
      const s = h01(i, 3)
      pos.set([x, 0, z, x, 1, z], i * 6)
      seed[i * 2] = s
      seed[i * 2 + 1] = s
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [])
  useFrame(({ clock, camera }) => {
    const r = sim.rain || 0
    const on = r > 0.02
    if (wet.current) {
      wet.current.visible = on
      if (on) wet.current.material.opacity = Math.min(0.5, r * 0.5)
    }
    if (!group.current) return
    group.current.visible = on && enabled && sim.scene === 'city'
    if (!group.current.visible) return
    group.current.position.set(camera.position.x, camera.position.y - 6, camera.position.z)
    mat.current.uniforms.uTime.value = clock.elapsedTime
    mat.current.uniforms.uRain.value = r
  })
  return (
    <>
      <group ref={group} visible={false}>
        <lineSegments geometry={geo} frustumCulled={false}>
          <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} transparent depthWrite={false} uniforms={{ uTime: { value: 0 }, uRain: { value: 0 } }} />
        </lineSegments>
      </group>
      <mesh ref={wet} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.112, 0]} visible={false}>
        <planeGeometry args={[60, 34]} />
        <meshStandardMaterial color="#101419" roughness={0.04} metalness={0.85} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </>
  )
}
