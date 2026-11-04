// Lyrics come from LRCLIB (https://lrclib.net) — free, no key, CORS-enabled.
// LRCLIB provides line-synced (.lrc) lyrics. Word timings are estimated from
// word length because LRCLIB does not provide word-level timestamps.

import type { LyricsData, LyricWord, SpotifyTrack, SyncedLine } from './types'

interface LrclibHit {
  duration: number
  syncedLyrics?: string | null
  plainLyrics?: string | null
}

interface RawLine {
  time: number
  text: string
}

export class LyricsUnavailableError extends Error {
  constructor() {
    super('The lyrics service is unavailable.')
    this.name = 'LyricsUnavailableError'
  }
}

const cache = new Map<string, LyricsData | null>()

const STAMP = /\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g

function parseLrc(lrc: string): RawLine[] {
  const raw: RawLine[] = []
  for (const row of lrc.split('\n')) {
    const stamps = [...row.matchAll(STAMP)]
    if (!stamps.length) continue
    const text = row.replace(/\[[^\]]*\]/g, '').trim()
    for (const s of stamps) {
      raw.push({ time: (Number(s[1]) * 60 + Number(s[2])) * 1000, text })
    }
  }
  return raw.sort((a, b) => a.time - b.time)
}

function withWords(lines: RawLine[], durationMs: number): SyncedLine[] {
  return lines.map((line, i) => {
    const end = lines[i + 1]?.time ?? Math.max(durationMs, line.time + 4000)
    const gap = end - line.time
    const parts = line.text.split(/\s+/).filter(Boolean)
    const total = parts.reduce((n, word) => n + word.length + 1, 0)
    const sing = Math.min(gap * 0.95, Math.max(800, total * 85))
    let cursor = line.time
    const words: LyricWord[] = parts.map((text) => {
      const span = ((text.length + 1) / total) * sing
      const word = { text, start: cursor, end: cursor + span }
      cursor += span
      return word
    })
    return { ...line, end, words }
  })
}

const cleanTitle = (name: string): string =>
  name
    .replace(/\s*[(\[](feat|with|from|remaster|live|version)[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+.*$/, '')
    .trim()

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

interface RequestState {
  // True if the most recent request failed outright (5xx or network error),
  // false if it got a real answer (including 404 "not found").
  lastFailed: boolean
}

// Retries once on 5xx/network errors.
async function getJson<T>(url: string, state: RequestState): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status >= 500) throw new Error(String(res.status))
      state.lastFailed = false
      return res.ok ? ((await res.json()) as T) : null
    } catch {
      if (attempt === 0) await sleep(700)
    }
  }
  state.lastFailed = true
  return null
}

export async function fetchLyrics(track: SpotifyTrack): Promise<LyricsData | null> {
  const cached = cache.get(track.id)
  if (cached !== undefined) return cached

  const artist = track.artists[0]?.name ?? ''
  const duration = Math.round(track.duration_ms / 1000)
  const state: RequestState = { lastFailed: false }

  const params = new URLSearchParams({
    artist_name: artist,
    track_name: track.name,
    album_name: track.album.name,
    duration: String(duration),
  })

  let hit = await getJson<LrclibHit>(`https://lrclib.net/api/get?${params}`, state)

  // /api/get can 503 under load (or when it can't find the track); /api/get-cached only reads LRCLIB's own database.
  if (!hit && state.lastFailed) {
    hit = await getJson<LrclibHit>(`https://lrclib.net/api/get-cached?${params}`, state)
  }

  if (!hit?.syncedLyrics && !hit?.plainLyrics) {
    const results = await getJson<LrclibHit[]>(
      'https://lrclib.net/api/search?' +
        new URLSearchParams({ track_name: cleanTitle(track.name), artist_name: artist }),
      state
    )
    if (Array.isArray(results)) {
      const usable = results.filter((r) => r.syncedLyrics || r.plainLyrics)
      usable.sort(
        (a, b) =>
          Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics)) ||
          Math.abs(a.duration - duration) - Math.abs(b.duration - duration)
      )
      hit = usable[0] ?? null
    }
  }

  let result: LyricsData | null = null
  if (hit?.syncedLyrics) {
    const lines = parseLrc(hit.syncedLyrics)
    if (lines.length) result = { synced: true, lines: withWords(lines, track.duration_ms) }
  }
  if (!result && hit?.plainLyrics) {
    const lines = hit.plainLyrics.split('\n').map((text) => ({ text: text.trim() }))
    result = { synced: false, lines }
  }

  // Only report an outage if the last request genuinely failed. A 404 means the service
  // answered and simply doesn't have this track, so that is a normal "no lyrics found".
  if (!result && state.lastFailed) throw new LyricsUnavailableError()
  cache.set(track.id, result)
  return result
} 