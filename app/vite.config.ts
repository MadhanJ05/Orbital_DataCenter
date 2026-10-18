import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base matches the GitHub Pages path: https://madhanj05.github.io/Orbital_DataCenter/app/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/Orbital_DataCenter/app/' : '/',
  server: { fs: { allow: ['..'] } }, // lets the app import ../shared/assumptions.json
})
