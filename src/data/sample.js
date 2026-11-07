import { locationFromPreset } from './locations.js'
import { makeEvent } from '../lib/schedule.js'

const h = (hh, mm = 0) => hh * 60 + mm

export function createSampleSchedule() {
  return {
    version: 1,
    custom: false,
    home: locationFromPreset('jaktim', 'Apartemen (contoh), Jakarta Timur'),
    office: { presetId: 'manual', lat: -6.1517, lng: 106.7306, label: 'PT. Indocyber Global Teknologi, Daan Mogot, Jakarta Barat' },
    manualMinutes: null,
    accent: 'cyan',
    activeDay: 'sen',
    days: {
      sen: {
        mode: 'kantor',
        events: [
          makeEvent('berangkat', h(7)),
          makeEvent('meeting', h(10), h(12)),
          makeEvent('istirahat', h(12), h(13)),
          makeEvent('fokus', h(13), h(15)),
          makeEvent('meeting', h(15), h(16, 30)),
          makeEvent('pulang', h(16, 30)),
        ],
      },
      sel: {
        mode: 'kantor',
        events: [
          makeEvent('berangkat', h(6, 45)),
          makeEvent('meeting', h(9, 30), h(10, 30)),
          makeEvent('fokus', h(10, 30), h(12)),
          makeEvent('istirahat', h(12), h(13)),
          makeEvent('fokus', h(13), h(16)),
          makeEvent('meeting', h(16), h(17)),
          makeEvent('pulang', h(17)),
        ],
      },
      rab: {
        mode: 'wfh',
        events: [
          makeEvent('fokus', h(8), h(10)),
          makeEvent('meeting', h(10), h(11)),
          makeEvent('fokus', h(11), h(12)),
          makeEvent('istirahat', h(12), h(13)),
          makeEvent('fokus', h(13), h(16)),
          makeEvent('meeting', h(16), h(16, 30)),
        ],
      },
      kam: {
        mode: 'kantor',
        events: [
          makeEvent('berangkat', h(7, 45)),
          makeEvent('meeting', h(8, 45), h(10)),
          makeEvent('fokus', h(10), h(12)),
          makeEvent('istirahat', h(12), h(13)),
          makeEvent('fokus', h(13), h(15, 30)),
          makeEvent('meeting', h(15, 30), h(16, 30)),
          makeEvent('pulang', h(16, 45)),
        ],
      },
      jum: {
        mode: 'kantor',
        events: [
          makeEvent('berangkat', h(7, 15)),
          makeEvent('meeting', h(9), h(10, 30)),
          makeEvent('meeting', h(10, 30), h(12)),
          makeEvent('istirahat', h(12), h(12, 45)),
          makeEvent('meeting', h(13), h(15)),
          makeEvent('meeting', h(15), h(16, 30)),
          makeEvent('fokus', h(16, 30), h(17, 15)),
          makeEvent('pulang', h(17, 30)),
        ],
      },
    },
  }
}

export function createBlankSchedule() {
  const base = createSampleSchedule()
  const days = {}
  for (const id of Object.keys(base.days)) {
    days[id] = { mode: 'kantor', events: [makeEvent('berangkat', h(7)), makeEvent('pulang', h(17))] }
  }
  return { ...base, days }
}
