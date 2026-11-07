export const PRESETS = [
  { id: 'jakpus', name: 'Jakarta Pusat', lat: -6.1862, lng: 106.834 },
  { id: 'jaksel', name: 'Jakarta Selatan', lat: -6.2615, lng: 106.8106 },
  { id: 'jaktim', name: 'Jakarta Timur', lat: -6.225, lng: 106.9004 },
  { id: 'jakbar', name: 'Jakarta Barat', lat: -6.1683, lng: 106.7589 },
  { id: 'jakut', name: 'Jakarta Utara', lat: -6.1384, lng: 106.8635 },
  { id: 'bogor', name: 'Bogor', lat: -6.595, lng: 106.8166 },
  { id: 'depok', name: 'Depok', lat: -6.4025, lng: 106.8186 },
  { id: 'tangerang', name: 'Tangerang', lat: -6.1783, lng: 106.6319 },
  { id: 'bekasi', name: 'Bekasi', lat: -6.2383, lng: 106.9756 },
]

export const findPreset = (id) => PRESETS.find((p) => p.id === id)

export function locationFromPreset(id, label) {
  const p = findPreset(id)
  return { presetId: id, lat: p.lat, lng: p.lng, label: label ?? p.name }
}
