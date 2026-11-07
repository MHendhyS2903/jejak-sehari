import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const MODELS_DIR = 'public/models'

function walk(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name), `${base}${e.name}/`) : e.name.endsWith('.glb') ? [`${base}${e.name.slice(0, -4)}`] : [],
  )
}

function embeddedModels() {
  const id = 'virtual:models'
  return {
    name: 'embedded-models',
    resolveId: (s) => (s === id ? '\0' + id : null),
    load(s) {
      if (s !== '\0' + id) return null
      const map = {}
      for (const n of walk(MODELS_DIR)) {
        map[n] = 'data:model/gltf-binary;base64,' + fs.readFileSync(path.join(MODELS_DIR, n + '.glb')).toString('base64')
      }
      return `export default ${JSON.stringify(map)}`
    },
  }
}

function standaloneHtml() {
  return {
    name: 'standalone-html',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const font = fs.readFileSync('public/fonts/PlusJakartaSans-Variable.woff2').toString('base64')
        return html
          .replace(/<script type="module" crossorigin/g, '<script defer')
          .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"')
          .replace(/url\(['"]?\.\/fonts\/PlusJakartaSans-Variable\.woff2['"]?\)/, `url(data:font/woff2;base64,${font})`)
      },
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), embeddedModels(), standaloneHtml()],
  build: {
    chunkSizeWarningLimit: 16000,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
})
