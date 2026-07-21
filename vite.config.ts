import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Caminhos relativos para os assets — evita página em branco quando o app
  // é servido a partir de um subcaminho (não da raiz do domínio).
  base: './',
  build: {
    // Sai em docs/ para publicar via GitHub Pages "Deploy from a branch".
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Encaminha chamadas de API para o backend (classificação por IA)
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
