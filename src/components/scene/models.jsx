import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { recolorMaterial } from '../../lib/recolor.js'
import files from 'virtual:models'

export const url = (n) => {
  if (!files[n]) throw new Error(`Model tidak ditemukan: ${n}`)
  return files[n]
}
Object.keys(files).forEach((n) => useGLTF.preload(files[n], false))

export function useParts(name, paint, fit) {
  const gltf = useGLTF(url(name), false)
  return useMemo(() => {
    gltf.scene.updateMatrixWorld(true)
    const parts = []
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        const geometry = o.geometry.clone()
        geometry.applyMatrix4(o.matrixWorld)
        const mat = Array.isArray(o.material) ? o.material[0] : o.material
        parts.push({ geometry, material: paint ? recolorMaterial(mat, paint) : mat, name: o.name })
      }
    })
    if (fit) {
      parts.forEach((p) => p.geometry.rotateY(fit.yaw || 0))
      const box = new THREE.Box3()
      parts.forEach((p) => {
        p.geometry.computeBoundingBox()
        box.union(p.geometry.boundingBox)
      })
      const k = fit.length / (box.max.z - box.min.z)
      const cx = (box.min.x + box.max.x) / 2
      const cz = (box.min.z + box.max.z) / 2
      parts.forEach((p) => {
        p.geometry.translate(-cx, -box.min.y, -cz)
        p.geometry.scale(k, k, k)
      })
      parts.size = { w: (box.max.x - box.min.x) * k, h: (box.max.y - box.min.y) * k, l: fit.length }
    } else if (name.startsWith('office/')) {
      const box = new THREE.Box3()
      parts.forEach((p) => {
        p.geometry.computeBoundingBox()
        box.union(p.geometry.boundingBox)
      })
      const cx = (box.min.x + box.max.x) / 2
      const cz = (box.min.z + box.max.z) / 2
      parts.forEach((p) => p.geometry.translate(-cx, -box.min.y, -cz))
    }
    return parts
  }, [gltf, paint, fit])
}

const tmp = new THREE.Object3D()
const tint = new THREE.Color()

export function InstancedModel({ name, items, cast = false, receive = true, material, ghost, paint }) {
  const parts = useParts(name, paint)
  const refs = useRef([])
  const mats = useMemo(
    () =>
      parts.map((p) => {
        if (material) return material
        if (!ghost) return p.material
        const m = p.material.clone()
        m.transparent = true
        m.opacity = ghost
        m.depthWrite = false
        return m
      }),
    [parts, material, ghost],
  )
  useLayoutEffect(() => {
    refs.current.forEach((mesh) => {
      if (!mesh) return
      items.forEach((it, i) => {
        tmp.position.set(it.x, it.y, it.z)
        tmp.rotation.set(0, it.rot || 0, 0)
        const s = it.s || 1
        tmp.scale.set(s, s * (it.sy ?? 1), s)
        tmp.updateMatrix()
        mesh.setMatrixAt(i, tmp.matrix)
        if (it.color) mesh.setColorAt(i, tint.set(it.color))
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }, [items, parts])
  if (!items.length) return null
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh
          key={`${name}-${i}-${items.length}`}
          ref={(m) => (refs.current[i] = m)}
          args={[p.geometry, mats[i], items.length]}
          castShadow={cast}
          receiveShadow={receive}
        />
      ))}
    </>
  )
}
