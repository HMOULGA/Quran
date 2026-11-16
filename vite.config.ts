import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Chemins relatifs : nécessaire pour Electron (protocole app://) et Capacitor
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  server: { watch: { ignored: ['**/android/**', '**/release/**', '**/electron/**'] } },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
})
