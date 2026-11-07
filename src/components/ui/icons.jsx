const P = {
  berangkat: 'M5 13l1.6-4.4A2 2 0 018.5 7.3h7a2 2 0 011.9 1.3L19 13m-14 0v4h2m-2-4h14m0 0v4h-2M8 17a1 1 0 100 .01M16 17a1 1 0 100 .01',
  meeting: 'M16 11a3 3 0 10-6 0 3 3 0 006 0zM4 19c0-2.8 2.7-5 6-5h2c3.3 0 6 2.2 6 5M19 8a2.2 2.2 0 010 4.2',
  istirahat: 'M5 9h11v5a4 4 0 01-4 4H9a4 4 0 01-4-4V9zm11 1.5h1.5a2 2 0 010 4H16M8 3.5v2M12 3.5v2',
  fokus: 'M12 4v2m0 12v2M4 12h2m12 0h2M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
  pulang: 'M4 11.5L12 5l8 6.5M6.5 10v8.5h11V10M10 18.5v-4.5h4v4.5',
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M8 5v14M16 5v14',
  chevron: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V5h4v2m-6 0l.7 12h6.6L16 7',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14',
  upload: 'M12 16V5m0 0L8 9m4-4l4 4M5 19h14',
  share: 'M12 4v11m0-11L8 8m4-4l4 4M6 13v6h12v-6',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4V8zm8 2.5a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4z',
  info: 'M12 11v5m0-8.5v.01M12 3a9 9 0 100 18 9 9 0 000-18z',
  warn: 'M12 9v4m0 3.5v.01M10.3 4.5L3 17.5A2 2 0 004.7 20.5h14.6A2 2 0 0021 17.5l-7.3-13a2 2 0 00-3.4 0z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  reset: 'M4 12a8 8 0 108-8H8m0 0l2.5-2.5M8 4l2.5 2.5',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zm0-5l1.2 2.2 2.5-.6.6 2.5 2.2 1.2-1.4 2.1 1.4 2.1-2.2 1.2-.6 2.5-2.5-.6L12 20l-1.2-2.2-2.5.6-.6-2.5L5.5 14.7 6.9 12.6 5.5 10.5l2.2-1.2.6-2.5 2.5.6L12 4z',
  pin: 'M12 21s6-5.4 6-10a6 6 0 10-12 0c0 4.6 6 10 6 10zm0-8a2 2 0 100-4 2 2 0 000 4z',
}

export function Icon({ name, size = 18, stroke = 1.8, fill = false, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}
