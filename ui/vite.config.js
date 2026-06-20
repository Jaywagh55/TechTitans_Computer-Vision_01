import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputsDir = path.resolve(__dirname, '..', 'outputs')

// Serve /outputs/ from the parent directory during development
function serveOutputsPlugin() {
  return {
    name: 'serve-outputs',
    configureServer(server) {
      server.middlewares.use('/outputs', (req, res, next) => {
        const filePath = path.join(outputsDir, decodeURIComponent(req.url.split('?')[0]))
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase()
          const types = { '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' }
          res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serveOutputsPlugin()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5200,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
