const S = 0
const N = Math.PI
const E = Math.PI / 2
const W = -Math.PI / 2

export const FLOOR = { x0: -13, x1: 13, z0: -9, z1: 9 }
export const CLUSTERS = [-7, -2].flatMap((cx) => [-6, -1].map((cz) => [cx, cz]))

const nodes = {}
const edges = []
const node = (k, x, z) => {
  nodes[k] = [x, z]
  return k
}
const link = (...ks) => ks.slice(1).forEach((k, i) => edges.push([ks[i], k]))
const nk = (x, z) => `n${x}_${+z.toFixed(2)}`
const at = (x, z) => node(nk(x, z), x, z)

const TZ = [-7.4, -4.6, -3.5, -2.4, 0.4, 3.0]
const trunks = { '-9': [...TZ, 6.5], '-4.5': [...TZ], '0.8': [-7.4, ...TZ.slice(1), 6.3] }
for (const [x, zs] of Object.entries(trunks)) {
  const X = +x
  const ks = zs.map((z) => at(X, z))
  link(...ks)
}
for (const z of [-3.5, 3.0]) link(nk(-9, z), nk(-4.5, z), nk(0.8, z))
link(nk(-4.5, -7.4), nk(0.8, -7.4))

node('D', -11.0, 6.5)
link(nk(-9, 6.5), 'D')

const desks = []
CLUSTERS.forEach(([cx, cz], ci) => {
  const c = ci < 2 ? 0 : 1
  ;[0, 1, 2, 3].forEach((q) => {
    const north = q < 2
    const east = q % 2 === 1
    const dx = east ? 0.76 : -0.76
    const seatZ = cz + (north ? -1.4 : 1.4)
    const viaX = c === 0 ? (east ? -4.5 : -9) : east ? 0.8 : -4.5
    desks.push({
      desk: [cx + dx, cz + (north ? -0.55 : 0.55)],
      seat: [cx + dx, seatZ],
      yaw: north ? S : N,
      via: nk(viaX, seatZ),
      cluster: ci,
    })
  })
})

node('LA', -4.0, 4.6)
node('LW', -4.0, 7.0)
node('LF', -2.0, 7.0)
link(nk(-4.5, 3), 'LA', 'LW', 'LF')
const couchSeats = [-2.6, -2.0, -1.4].map((x) => ({ seat: [x, 7.95], yaw: N, via: 'LF' }))
couchSeats.push({ seat: [0.0, 6.3], yaw: W, via: nk(0.8, 6.3) })

node('MDo', 3.0, 4.2)
node('MDi', 5.2, 4.2)
link(nk(0.8, 3), 'MDo', 'MDi')
const mx = [7, 8, 9, 10]
node('MNw', 5.2, 1.6)
node('MSw', 5.2, 6.8)
link('MDi', 'MNw')
link('MDi', 'MSw')
mx.forEach((x) => {
  node(`MN${x}`, x, 1.6)
  node(`MS${x}`, x, 6.8)
})
link('MNw', ...mx.map((x) => `MN${x}`))
link('MSw', ...mx.map((x) => `MS${x}`))
node('ME1', 11.6, 1.6)
link(`MN${mx[mx.length - 1]}`, 'ME1')
const meet = [
  ...mx.map((x) => ({ seat: [x, 3.2], yaw: S, via: `MN${x}` })),
  ...mx.map((x) => ({ seat: [x, 5.2], yaw: N, via: `MS${x}` })),
  { seat: [5.5, 4.2], yaw: E, via: 'MDi' },
  { seat: [11.55, 4.2], yaw: W, via: 'ME1' },
]

const px = 6.4
const pcol = [-2.6, -3.2, -5.12, -6.2, -8.5]
pcol.forEach((z) => at(px, z))
link(...pcol.map((z) => nk(px, z)))
node('PA', 3.0, -1.0)
node('PB', px, -1.0)
link(nk(0.8, -2.4), 'PA', 'PB', nk(px, -2.6))
const lane = [7.5, 9.7, 10.7, 12.9]
lane.forEach((x) => at(x, -2.6))
link(nk(px, -2.6), ...lane.map((x) => nk(x, -2.6)))
const stoolX = [8.4, 9.3, 10.2]
stoolX.forEach((x) => at(x, -6.2))
link(nk(px, -6.2), ...stoolX.map((x) => nk(x, -6.2)))
const pantryTables = [
  { seat: [7.5, -4.0], yaw: E, via: nk(7.5, -2.6) },
  { seat: [9.7, -4.0], yaw: W, via: nk(9.7, -2.6) },
  { seat: [10.7, -4.0], yaw: E, via: nk(10.7, -2.6) },
  { seat: [12.9, -4.0], yaw: W, via: nk(12.9, -2.6) },
]
const bar = stoolX.map((x) => ({ seat: [x, -7.6], yaw: N, via: nk(x, -6.2) }))
const pantryStand = [
  { pos: [7.2, -5.0], yaw: W, via: nk(px, -5.12) },
  { pos: [7.2, -6.4], yaw: W, via: nk(px, -6.2) },
  { pos: [7.2, -7.7], yaw: W, via: nk(px, -8.5) },
  { pos: [7.9, -5.7], yaw: N, via: nk(px, -6.2) },
  { pos: [7.0, -3.7], yaw: E, via: nk(px, -3.2) },
]
const coffee = { pos: [6.45, -5.12], yaw: W, via: nk(px, -5.12) }
const fridge = { pos: [6.45, -8.45], yaw: W, via: nk(px, -8.5) }

node('PR', 2.6, -6.4)
link(nk(0.8, -7.4), 'PR')
const printer = { pos: [2.6, -7.35], yaw: N, via: 'PR' }

at(0.8, -3.5)
const chat = [
  [{ pos: [-4.95, -3.5], yaw: E }, { pos: [-4.05, -3.5], yaw: W }, { pos: [-4.5, -3.0], yaw: N }].map((p) => ({ ...p, via: nk(-4.5, -3.5) })),
  [{ pos: [0.2, -3.5], yaw: E }, { pos: [1.4, -3.5], yaw: W }, { pos: [0.8, -3.0], yaw: N }].map((p) => ({ ...p, via: nk(0.8, -3.5) })),
  [{ pos: [7.1, -3.1], yaw: E }, { pos: [8.0, -3.1], yaw: W }, { pos: [7.55, -2.7], yaw: N }].map((p) => ({ ...p, via: nk(px, -3.2) })),
]

const obstacles = [
  ...CLUSTERS.map(([cx, cz]) => [cx - 1.6, cz - 0.95, cx + 1.6, cz + 0.95]),
  [1.8, -8.8, 3.4, -7.9],
  [5.0, -9, 5.95, -3.1],
  [8.0, -8.8, 10.7, -8.2],
  [8.0, -4.5, 9.2, -3.5],
  [11.2, -4.5, 12.4, -3.5],
  [6.0, 3.65, 11.0, 4.75],
  [3.95, 0, 4.1, 3.6],
  [3.95, 4.8, 4.1, 9],
  [4, -0.15, 13, 0.15],
  [-3.2, 7.6, -0.8, 8.9],
  [-2.8, 5.5, -1.2, 6.3],
  [-12.0, 1.4, -9.7, 3.5],
  [-13, -8.8, -12.1, -2.9],
]

export const OFFICE = {
  id: 'office',
  nodes,
  edges,
  door: { node: 'D', spawn: [-12.3, 6.5], yaw: E },
  desks,
  meet,
  coffee,
  fridge,
  printer,
  bar,
  pantryTables,
  pantryStand,
  couchSeats,
  chat,
  obstacles,
  camera: { pos: [14, 19, 19], look: [0, 0.2, 0.8] },
  follow: [3.4, 4.4, 5.4],
}

const hn = {
  H1: [-3.3, -0.9],
  HM: [-1.4, 0.2],
  HC: [-0.2, 2.5],
}
export const HOME = {
  id: 'home',
  nodes: hn,
  edges: [['H1', 'HM'], ['HM', 'HC']],
  door: { node: 'H1', spawn: [-3.3, -0.9], yaw: S },
  desks: [{ desk: [-3.3, -3.3], seat: [-3.3, -2.0], yaw: N, via: 'H1', cluster: 0 }],
  couchSeats: [0.9, 1.5, 2.1].map((x) => ({ seat: [x, 3.0], yaw: N, via: 'HC' })),
  obstacles: [],
  camera: { pos: [8, 10, 11], look: [0, 0.5, 0.2] },
  follow: [4.5, 5.5, 6.5],
}
