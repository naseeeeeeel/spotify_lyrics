# Lyrica

Word-by-word Spotify lyrics. React + TypeScript + Vite + Tailwind CSS v4. No backend: sign-in uses
Spotify's Authorization Code flow with PKCE straight from the browser.

## Setup

1. Go to https://developer.spotify.com/dashboard and create an app.
   - Redirect URI: `http://127.0.0.1:5173/` (exactly this, with the trailing slash)
   - APIs used: Web API
2. In the app's settings, open **User Management** and add the email of your Spotify account
   (apps in development mode only work for listed users).
3. In this folder:
   ```bash
   cp .env.example .env      # set VITE_SPOTIFY_CLIENT_ID in .env
   npm install
   npm run dev
   ```
4. Open **http://127.0.0.1:5173** (not `localhost`) and click **Connect Spotify**.

## GitHub Pages

The app is deployed to `https://naseeeeeeel.github.io/spotify_lyrics/` by the
GitHub Actions workflow when changes are pushed to `main`.

1. Add `https://naseeeeeeel.github.io/spotify_lyrics/` as a redirect URI in the Spotify app settings.
   The URL must include the `/spotify_lyrics/` path and end in `/`.
2. In the repository settings, add an Actions variable named
   `VITE_SPOTIFY_CLIENT_ID` with the Spotify app's Client ID.
3. Push to `main`; the workflow builds and deploys the site.

## Scripts

- `npm run dev` — start the dev server
- `npm run typecheck` — run the TypeScript compiler without emitting files
- `npm run build` — typecheck, then build for production

## Using it

- Play something in any Spotify app; Lyrica follows it.
- Press `/` (or Ctrl/Cmd+K) to search and play any song. Space plays or pauses.
- Click any lyric line to jump to it.
- Lyrics running early or late? Use the timing − / + buttons.

## Notes

- Changing songs, pausing and seeking require Spotify Premium and an available Spotify device
  (phone, desktop app or web player). If playback hasn't started yet, open Spotify so it can
  register as a device; Lyrica can then transfer playback to it. Reading what's playing works on
  free accounts.
- Lyrics come from LRCLIB. Spotify doesn't expose word-level timing, so words are timed
  proportionally within each line's timestamps.
