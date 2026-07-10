import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this project site from /bow-physics/, so the built asset URLs need that
// prefix. The dev server stays at the root. https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/bow-physics/' : '/',
  plugins: [react()],
}))
