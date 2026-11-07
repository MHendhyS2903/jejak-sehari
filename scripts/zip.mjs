import archiver from 'archiver'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const out = path.join(root, 'jejak-sehari.zip')

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html tidak ditemukan. Jalankan build dulu.')
  process.exit(1)
}
if (fs.existsSync(out)) fs.rmSync(out)

const output = fs.createWriteStream(out)
const zip = archiver('zip', { zlib: { level: 9 } })
output.on('close', () => {
  console.log(`jejak-sehari.zip dibuat (${(zip.pointer() / 1024 / 1024).toFixed(2)} MB)`)
})
zip.on('error', (e) => { throw e })
zip.pipe(output)
zip.directory(dist, false)
await zip.finalize()
