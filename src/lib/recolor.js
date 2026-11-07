import * as THREE from 'three'

export function recolorMaterial(mat, map) {
  const spec = map?.[mat.name]
  if (!spec) return mat
  const m = mat.clone()
  const s = typeof spec === 'string' ? { color: spec } : spec
  if (s.color) m.color = new THREE.Color(s.color)
  if (s.roughness != null) m.roughness = s.roughness
  if (s.metalness != null) m.metalness = s.metalness
  if (s.opacity != null) {
    m.transparent = true
    m.opacity = s.opacity
    m.depthWrite = false
  }
  if (s.emissive) {
    m.emissive = new THREE.Color(s.emissive)
    m.emissiveIntensity = s.emissiveIntensity ?? 1
  }
  return m
}

export function recolor(root, map) {
  root.traverse((o) => {
    if (!o.isMesh) return
    o.material = Array.isArray(o.material) ? o.material.map((m) => recolorMaterial(m, map)) : recolorMaterial(o.material, map)
  })
  return root
}

export const GLASS = { color: '#BFD9F2', opacity: 0.3, roughness: 0.05, metalness: 0.1 }

export const WHITE = '#F2F2F0'
export const DARK = '#3A3F45'

export const OFFICE_PAINT = {
  desk: { wood: WHITE, metal: DARK },
  deskCorner: { wood: WHITE, metal: DARK },
  table: { wood: WHITE, metal: DARK },
  tableGlass: { metal: DARK, glass: GLASS },
  tableRound: { wood: WHITE },
  chairDesk: { carpet: '#2B2E33', metalMedium: '#4B5563' },
  chairModernCushion: { carpet: '#1F3A5F', carpetBlue: '#1F3A5F', metal: '#9AA3AE' },
  chair: { wood: '#E5E7EB' },
  stoolBar: { carpet: '#2B2E33', wood: '#D9DCE0' },
  loungeDesignSofa: { carpet: '#6B7280', carpetBlue: '#6B7280' },
  loungeChair: { carpet: '#6B7280', wood: '#D9DCE0' },
  tableCoffeeGlass: { glass: GLASS, metal: DARK },
  rugRectangle: { carpet: '#7C8796', carpetDarker: '#5B6572' },
  kitchenCabinet: { wood: WHITE, woodDark: '#8A9099' },
  kitchenCabinetUpper: { wood: WHITE, woodDark: '#8A9099' },
  kitchenSink: { wood: WHITE, woodDark: '#8A9099' },
  kitchenBar: { wood: WHITE, woodDark: '#8A9099' },
  kitchenBarEnd: { wood: WHITE },
  bookcaseClosedWide: { wood: '#D9DCE0' },
  bookcaseOpenLow: { wood: '#D9DCE0' },
  pottedPlant: { wood: '#CBD5E1', woodDark: '#94A3B8' },
  wall: { wood: '#F3F4F6' },
  wallWindow: { wood: '#F3F4F6', glass: GLASS },
  wallDoorwayWide: { wood: '#F3F4F6' },
  wallHalf: { wood: '#F3F4F6' },
  doorwayOpen: { wood: '#E5E7EB' },
  coatRackStanding: { wood: '#9AA3AE' },
}

export const HOME_PAINT = {
  wallWindow: { glass: GLASS },
  tableGlass: { glass: GLASS },
  tableCoffeeGlass: { glass: GLASS },
}

export const SHIRTS = ['#F8FAFC', '#BFDBFE', '#1E3A8A', '#9CA3AF', '#E8DCC2', '#9CAF88', '#7F1D1D', '#B8860B']
export const PANTS = ['#111827', '#1E2A4A', '#374151', '#B7A27D']
export const HAIRS = ['#0B0B0C', '#3B2A20', '#5A3B28', '#8C8C8C']
export const SKINS = ['#8D5A3B', '#A66B45', '#C68B59', '#D9A273', '#E6B98C', '#F0CBA0']

export function paintWorker(root, look) {
  const map = {
    Shirt: look.shirt, Shirt2: look.shirt, Dress: look.shirt, Jacket: look.shirt, LightJacket: look.shirt,
    Pants: look.pants, Skin: look.skin, Hair: look.hair, Hair2: look.hair, HairBase: look.hair, Eyebrows: look.hair,
  }
  recolor(root, map)
  return root
}
