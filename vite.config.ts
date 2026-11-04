import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Spotify only allows loopback redirects via 127.0.0.1 (not "localhost"),
// so the dev server is pinned to that address.
export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/spotify_lyrics/' : '/',
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
}))
