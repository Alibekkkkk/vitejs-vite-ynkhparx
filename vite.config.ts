import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Firebase is a single vendor bundle of about 620 kB that is cached separately.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Firebase and React rarely change, so keeping them in their own files lets browsers
        // cache them across portal updates and keeps the application chunk small.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@firebase') || id.includes('/firebase/')) return 'firebase'
          if (id.includes('react') || id.includes('scheduler')) return 'react'
          return undefined
        },
      },
    },
  },
})
