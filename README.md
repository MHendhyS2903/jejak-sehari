# Jejak Sehari

Lihat ke mana harimu pergi — visualisasi 3D jadwal hari kerja di kota low-poly, lengkap dengan insight perjalanan, meeting, dan jam fokus.

Aplikasi 100% statis (Vite + React + Three.js). Tanpa backend, tanpa database.

## Pengembangan

```bash
npm install
npm run dev
```

## Build

```bash
npm run build      # hasil di dist/
npm run preview    # uji hasil build secara lokal
```

## Zip untuk portal

```bash
npm run zip
```

Perintah ini menjalankan build lalu membuat `jejak-sehari.zip` yang berisi isi folder `dist` (file `index.html` ada di root zip). Semua path aset relatif (`base: './'`), sehingga aman dijalankan di dalam iframe.

## Struktur

- `src/components/scene/` — kota 3D, langit, mobil, kamera, checkpoint
- `src/components/ui/` — editor jadwal, timeline, insight, modal
- `src/lib/` — waktu, estimasi perjalanan, penyimpanan, insight, timeline
- `src/data/` — preset lokasi dan jadwal contoh
- `public/models/{office,people,jakarta}` — furnitur kantor, karakter, dan kota Jakarta; `public/models/*.glb` — jalan; `public/fonts` — font

## Catatan

- Estimasi durasi memakai OSRM publik (timeout 5 dtk) dengan cadangan hitungan offline. Rute di kota 3D bersifat stilistik.
- Semua model GLB juga disematkan ke dalam bundle saat build, sehingga `index.html` bisa dibuka langsung tanpa server.
- Jadwal disimpan di `localStorage`; bila diblokir, aplikasi tetap berjalan dengan state di memori.

## Peta 2D offline

Mode "Peta 2D" menggambar sendiri jalan, sungai, laut, dan taman Jabodetabek dari data OpenStreetMap yang tertanam (`src/data/basemap.json`, dibuat oleh `scripts/build-basemap.mjs`). Tidak ada tile atau layanan peta; hanya jalur rute yang diambil dari OSRM (dengan cadangan garis lurus).
