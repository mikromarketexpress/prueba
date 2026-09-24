import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // rutas relativas para deploy flexible
  plugins: [react()],
  server: {
    port: 5173,        // puerto estándar de Vite
    open: true,        // abre navegador automáticamente
    host: '0.0.0.0',   // accesible desde red local
    strictPort: false,  // si 5173 está ocupado, usa el siguiente
  },
  build: {
    outDir: 'dist',
    sourcemap: true,   // mapas de código fuente para debugging
  },
  resolve: {
    alias: {
      '@': '/src',     // atajo de importación: import X from '@/components/X'
    },
  },
})
