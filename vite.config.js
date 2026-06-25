import { defineConfig } from 'vite'

export default defineConfig({
  base: '/cad-viewer/',
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'dxf-viewer': ['dxf-viewer'],
        },
      },
    },
  },
})
