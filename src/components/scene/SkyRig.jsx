import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { nightU, skyColors, sunInfo } from './sky.js'
import { useSim } from './SimContext.js'
import { smooth } from '../../lib/time.js'

const domeVert = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const domeFrag = `
  uniform vec3 uTop;
  uniform vec3 uHor;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, 0.0, 1.0);
    vec3 c = mix(uHor, uTop, pow(h, 0.5));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function makeStars(n) {
  const pos = new Float32Array(n * 3)
  let seed = 5
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const y = 0.15 + rnd() * 0.85
    const r = Math.sqrt(1 - y * y)
    pos.set([Math.cos(a) * r * 150, y * 150, Math.sin(a) * r * 150], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return g
}

const HAZE = new THREE.Color('#bcb2a4')
const GREY = new THREE.Color('#4a525c')
const MOON_DIR = new THREE.Vector3(-0.5, 0.75, -0.45).normalize()

export default function SkyRig({ shadows }) {
  const sim = useSim()
  const { camera } = useThree()
  const dome = useRef()
  const fog = useRef()
  const sun = useRef()
  const sunMesh = useRef()
  const moonMesh = useRef()
  const hemi = useRef()
  const stars = useRef()
  const dir = useMemo(() => new THREE.Vector3(), [])
  const zn = useMemo(() => new THREE.Color(), [])
  const hz = useMemo(() => new THREE.Color(), [])
  const tmp = useMemo(() => new THREE.Color(), [])
  const uniforms = useMemo(() => ({ uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } }), [])
  const starGeo = useMemo(() => makeStars(260), [])
  const sunCol = useMemo(() => new THREE.Color(), [])
  const warm = useMemo(() => new THREE.Color('#ff8a50'), [])
  const white = useMemo(() => new THREE.Color('#fff4e0'), [])
  const moonCol = useMemo(() => new THREE.Color('#7f95ff'), [])

  useFrame(() => {
    const minute = sim.envMinute ?? sim.minute
    skyColors(minute, zn, hz)
    const rain = sim.rain || 0
    const haze = 0.3 * (1 - (sim.night ?? 0))
    hz.lerp(HAZE, haze + rain * 0.35)
    zn.lerp(GREY, rain * 0.55)
    const info = sunInfo(minute, dir)
    nightU.value = info.night
    sim.night = info.night

    uniforms.uTop.value.copy(zn)
    uniforms.uHor.value.copy(hz)
    dome.current.position.copy(camera.position)
    fog.current.color.copy(hz)

    const sunI = 2.3 * smooth(0, 0.4, info.sinElev) * (1 - 0.6 * rain)
    const moonI = 0.55 * info.night
    sunCol.copy(warm).lerp(white, smooth(0.05, 0.5, info.sinElev)).lerp(moonCol, info.night)
    sun.current.color.copy(sunCol)
    sun.current.intensity = sunI + moonI
    const d = dir.clone().multiplyScalar(1 - info.night).addScaledVector(MOON_DIR, info.night).normalize()
    sun.current.position.set(d.x * 40, d.y * 40, d.z * 40)
    sun.current.target.position.set(0, 0, 0)
    sun.current.target.updateMatrixWorld()

    hemi.current.intensity = (0.3 + 0.7 * (1 - info.night)) * (1 - 0.25 * rain)
    fog.current.near = 14
    fog.current.far = 105 - rain * 40
    hemi.current.color.copy(hz).lerp(tmp.set('#ffffff'), 0.5)
    hemi.current.groundColor.copy(zn).multiplyScalar(0.5)

    sunMesh.current.position.copy(dir).multiplyScalar(120).add(camera.position)
    sunMesh.current.visible = info.sinElev > -0.06
    sunMesh.current.scale.setScalar(1 + (1 - smooth(0, 0.5, info.sinElev)) * 0.8)
    moonMesh.current.position.copy(MOON_DIR).multiplyScalar(120).add(camera.position)
    moonMesh.current.visible = info.night > 0.3
    moonMesh.current.material.opacity = smooth(0.3, 0.9, info.night)
    stars.current.material.opacity = smooth(0.45, 1, info.night)
    stars.current.position.copy(camera.position)
  }, -1)

  return (
    <>
      <fog ref={fog} attach="fog" args={['#bfe2ff', 14, 105]} />
      <mesh ref={dome} frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[200, 24, 16]} />
        <shaderMaterial uniforms={uniforms} vertexShader={domeVert} fragmentShader={domeFrag} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <points ref={stars} geometry={starGeo} frustumCulled={false}>
        <pointsMaterial color="#cfd8ff" size={1.6} sizeAttenuation={false} transparent opacity={0} depthWrite={false} fog={false} />
      </points>
      <mesh ref={sunMesh} frustumCulled={false}>
        <sphereGeometry args={[6, 16, 12]} />
        <meshBasicMaterial color={[6, 4.2, 2.4]} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={moonMesh} frustumCulled={false}>
        <sphereGeometry args={[4.5, 16, 12]} />
        <meshBasicMaterial color={[2.2, 2.4, 3]} toneMapped={false} fog={false} transparent />
      </mesh>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
    </>
  )
}
