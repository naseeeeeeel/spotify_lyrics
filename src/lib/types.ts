/* ---------- Spotify Web API (only the fields Lyrica uses) ---------- */

export interface SpotifyImage {
  url: string
  width: number | null
  height: number | null
}

export interface SpotifyArtist {
  id: string
  name: string
}

export interface SpotifyAlbum {
  id: string
  name: string
  images: SpotifyImage[]
}

export interface SpotifyTrack {
  id: string
  name: string
  uri: string
  duration_ms: number
  type?: string
  artists: SpotifyArtist[]
  album: SpotifyAlbum
  // Set when Spotify plays a regional equivalent of the track you asked for (track relinking).
  linked_from?: { id: string }
}

export interface SpotifyDevice {
  id: string | null
  name: string
  type: string
  is_active: boolean
  is_restricted?: boolean
}

export interface PlaybackState {
  is_playing: boolean
  progress_ms: number | null
  item: SpotifyTrack | null
  currently_playing_type: string
  device: SpotifyDevice | null
}

export interface SpotifyQueue {
  currently_playing: SpotifyTrack | null
  queue: SpotifyTrack[]
}

/* ---------- Lyrics ---------- */

export interface LyricWord {
  text: string
  start: number // ms
  end: number // ms
}

export interface SyncedLine {
  time: number // ms
  end: number // ms
  text: string
  words: LyricWord[]
}

export interface PlainLine {
  text: string
}

export interface SyncedLyrics {
  synced: true
  lines: SyncedLine[]
}

export interface PlainLyrics {
  synced: false
  lines: PlainLine[]
}

export type LyricsData = SyncedLyrics | PlainLyrics

export type LyricsStatus = 'idle' | 'loading' | 'ready' | 'error'