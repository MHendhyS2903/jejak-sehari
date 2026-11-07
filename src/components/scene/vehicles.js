import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const M4 = new THREE.Matrix4()

function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  g.deleteAttribute('uv')
  M4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1))
  g.applyMatrix4(M4)
  const c = new THREE.Color(color)
  const arr = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = c.r
    arr[i + 1] = c.g
    arr[i + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const cyl = (r, w, seg = 8) => new THREE.CylinderGeometry(r, r, w, seg).rotateZ(Math.PI / 2)
const sph = (r) => new THREE.SphereGeometry(r, 8, 6)

const merge = (list) => mergeGeometries(list, false)

export function motorGeometry({ jacket = '#1f9d55', helmet = '#f5f5f5', pair = false } = {}) {
  const dark = '#2b2f36'
  const list = [
    part(cyl(0.075, 0.035), '#16181c', { y: 0.075, z: 0.17 }),
    part(cyl(0.075, 0.035), '#16181c', { y: 0.075, z: -0.16 }),
    part(box(0.09, 0.08, 0.3), '#c0392b', { y: 0.16, z: 0.0 }),
    part(box(0.07, 0.07, 0.12), '#394150', { y: 0.22, z: 0.12 }),
    part(box(0.1, 0.035, 0.24), dark, { y: 0.215, z: -0.1 }),
    part(box(0.2, 0.025, 0.025), dark, { y: 0.31, z: 0.15 }),
    part(sph(0.03), '#ffe9a8', { y: 0.25, z: 0.2 }),
    part(box(0.13, 0.2, 0.09), jacket, { y: 0.36, z: -0.03, rx: -0.2 }),
    part(sph(0.065), helmet, { y: 0.52, z: 0.03 }),
    part(box(0.045, 0.045, 0.17), jacket, { x: -0.085, y: 0.38, z: 0.07, rx: 0.5 }),
    part(box(0.045, 0.045, 0.17), jacket, { x: 0.085, y: 0.38, z: 0.07, rx: 0.5 }),
    part(box(0.05, 0.05, 0.16), '#232834', { x: -0.075, y: 0.25, z: 0.0 }),
    part(box(0.05, 0.05, 0.16), '#232834', { x: 0.075, y: 0.25, z: 0.0 }),
  ]
  if (pair) {
    list.push(
      part(box(0.12, 0.2, 0.08), '#d9dde3', { y: 0.37, z: -0.16, rx: -0.1 }),
      part(sph(0.06), '#2b2f36', { y: 0.53, z: -0.15 }),
      part(box(0.04, 0.04, 0.12), '#d9dde3', { x: -0.08, y: 0.36, z: -0.08, rx: 0.4 }),
      part(box(0.04, 0.04, 0.12), '#d9dde3', { x: 0.08, y: 0.36, z: -0.08, rx: 0.4 }),
    )
  }
  return merge(list)
}

export function bajajGeometry() {
  return merge([
    part(cyl(0.08, 0.04), '#16181c', { y: 0.08, z: 0.28 }),
    part(cyl(0.08, 0.04), '#16181c', { x: -0.17, y: 0.08, z: -0.2 }),
    part(cyl(0.08, 0.04), '#16181c', { x: 0.17, y: 0.08, z: -0.2 }),
    part(box(0.36, 0.22, 0.62), '#f07a1b', { y: 0.26, z: -0.04 }),
    part(box(0.3, 0.2, 0.2), '#f07a1b', { y: 0.26, z: 0.3 }),
    part(box(0.38, 0.04, 0.62), '#1d4e89', { y: 0.46, z: -0.06 }),
    part(box(0.3, 0.14, 0.02), '#8fc7ee', { y: 0.34, z: 0.41 }),
    part(sph(0.05), '#ffe9a8', { y: 0.2, z: 0.41 }),
  ])
}

export function cartGeometry() {
  return merge([
    part(cyl(0.07, 0.03), '#16181c', { x: -0.17, y: 0.07, z: 0.1 }),
    part(cyl(0.07, 0.03), '#16181c', { x: 0.17, y: 0.07, z: 0.1 }),
    part(box(0.34, 0.2, 0.46), '#d9b27c', { y: 0.2 }),
    part(box(0.36, 0.03, 0.48), '#8a8f94', { y: 0.32 }),
    part(box(0.02, 0.3, 0.02), '#6b7280', { x: 0.15, y: 0.46, z: -0.15 }),
    part(box(0.02, 0.3, 0.02), '#6b7280', { x: -0.15, y: 0.46, z: -0.15 }),
    part(box(0.36, 0.02, 0.3), '#e04545', { y: 0.62, z: -0.1 }),
  ])
}

export function roofGeometry() {
  const g = new THREE.BufferGeometry()
  const v = [
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0.32, -0.5,
    -0.5, 0, 0.5, 0, 0.32, 0.5, 0.5, 0, 0.5,
    -0.5, 0, -0.5, 0, 0.32, -0.5, 0, 0.32, 0.5, -0.5, 0, -0.5, 0, 0.32, 0.5, -0.5, 0, 0.5,
    0.5, 0, -0.5, 0.5, 0, 0.5, 0, 0.32, 0.5, 0.5, 0, -0.5, 0, 0.32, 0.5, 0, 0.32, -0.5,
  ]
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3))
  g.computeVertexNormals()
  return g
}
