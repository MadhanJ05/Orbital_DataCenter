import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base matches the GitHub Pages path: https://madhanj05.github.io/Orbital_DataCenter/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/Orbital_DataCenter/' : '/',
})
