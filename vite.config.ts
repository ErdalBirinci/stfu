import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]

export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/, so the bundle needs that base.
  base: process.env.GITHUB_ACTIONS && repository ? `/${repository}/` : '/',
  plugins: [react(), tailwindcss()],
})
