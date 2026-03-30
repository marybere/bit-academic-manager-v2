import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // PWA manifest injected via index.html — icons reference bit-logo.png directly
})
