import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { handleRedirect, isLoggedIn, logout } from './lib/spotify'
import { fetchLyrics } from './lib/lyrics'
import { usePlayback } from './hooks/usePlayback'
import type { LyricsData, LyricsStatus } from './lib/types'
import Background from './components/Background'
import Controls from './components/Controls'
import Lyrics from './components/Lyrics'
import Login from './components/Login'
import Settings from './components/Settings'
import { loadGoogleFont, loadSettings, saveSettings, FONT_OPTIONS } from './lib/settings'
import type { PlayerSettings } from './lib/settings'

export default function App() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState<boolean>(isLoggedIn())
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    handleRedirect()
      .then(() => setAuthed(isLoggedIn()))
      .catch((e: unknown) => setAuthError(e instanceof Error ? e.message : 'Sign-in failed.'))
      .finally(() => setReady(true))
  }, [])

  const signOut = useCallback(() => {
    logout()
    setAuthed(false)
  }, [])

  if (!ready) return null
  if (!authed) return <Login error={authError} />
  return <Player onSignedOut={signOut} />
}

interface LyricsState {
  trackId: string
  status: LyricsStatus
  data: LyricsData | null
  phase: 'out' | 'loading' | 'in' | 'visible'
}

function Player({ onSignedOut }: { onSignedOut: () => void }) {
  const [settings, setSettings] = useState<PlayerSettings>(loadSettings)
  const [lyricsVisible, setLyricsVisible] = useState(true)
  const [controlsCollapsed, setControlsCollapsed] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const pb = usePlayback({ onSignedOut, queueOpen })
  const { track, error, clearError, togglePlay, next, previous, seek, getPosition } = pb
  const [retryKey, setRetryKey] = useState(0)
  const [lyrics, setLyrics] = useState<LyricsState>({ trackId: '', status: 'idle', data: null, phase: 'loading' })
  const lyricsRef = useRef(lyrics)
  lyricsRef.current = lyrics
  const [offset, setOffsetState] = useState<number>(() => Number(localStorage.getItem('lyrica_offset') ?? 250))

  const setOffset = (v: number) => {
    setOffsetState(v)
    localStorage.setItem('lyrica_offset', String(v))
  }

  const updateSetting = <K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const toggleLyrics = useCallback(() => {
    if (lyricsVisible && controlsCollapsed) setControlsCollapsed(false)
    setLyricsVisible((visible) => !visible)
  }, [controlsCollapsed, lyricsVisible])

  const toggleControls = useCallback(() => {
    if (!controlsCollapsed && !lyricsVisible) setLyricsVisible(true)
    setControlsCollapsed((collapsed) => !collapsed)
  }, [controlsCollapsed, lyricsVisible])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    loadGoogleFont(settings.font)
    const font = FONT_OPTIONS.find(({ value }) => value === settings.font)
    if (font) document.documentElement.style.setProperty('--app-font', font.family)
  }, [settings.font])

  const trackId = track?.id
  useEffect(() => {
    if (!track) return undefined
    let dead = false
    let loadingTimer: ReturnType<typeof setTimeout> | undefined
    let visibleTimer: ReturnType<typeof setTimeout> | undefined
    const previous = lyricsRef.current
    const fadePrevious = previous.data !== null

    if (fadePrevious) setLyrics({ ...previous, phase: 'out' })
    else setLyrics({ trackId: track.id, status: 'loading', data: null, phase: 'loading' })

    const result = fetchLyrics(track)
      .then((data) => ({ status: 'ready' as const, data }))
      .catch(() => ({ status: 'error' as const, data: null }))

    void (async () => {
      if (fadePrevious) {
        await new Promise<void>((resolve) => {
          loadingTimer = setTimeout(resolve, 240)
        })
        if (dead) return
        setLyrics({ trackId: track.id, status: 'loading', data: null, phase: 'loading' })
        await new Promise<void>((resolve) => {
          visibleTimer = setTimeout(resolve, 350)
        })
      }

      const loaded = await result
      if (dead) return
      setLyrics({ trackId: track.id, ...loaded, phase: 'in' })
      visibleTimer = setTimeout(() => {
        setLyrics((current) => current.trackId === track.id ? { ...current, phase: 'visible' } : current)
      }, 450)
    })()

    return () => {
      dead = true
      if (loadingTimer) clearTimeout(loadingTimer)
      if (visibleTimer) clearTimeout(visibleTimer)
    }
    // Only refetch when the track changes (or on retry), not on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, retryKey])

  // Auto-dismiss errors
  useEffect(() => {
    if (!error) return undefined
    const t = setTimeout(clearError, 15000)
    return () => clearTimeout(t)
  }, [error, clearError])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target
      if (
        !track ||
        e.defaultPrevented ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.closest('input, textarea, select, button, a, [role="slider"]')))
      ) return

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const delta = e.key === 'ArrowLeft' ? -5000 : 5000
        seek(Math.max(0, Math.min(track.duration_ms, getPosition() + delta)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        previous()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        next()
      } else if (e.key.toLowerCase() === 'l') {
        toggleLyrics()
      } else if (e.key.toLowerCase() === 'q') {
        setQueueOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [getPosition, next, previous, seek, toggleLyrics, togglePlay, track])

  return (
    <div
      className="app-shell relative h-full w-full overflow-hidden"
      data-theme={settings.theme}
      data-compact-layout={settings.compactLayout}
      data-reduced-motion={settings.reducedMotion}
      style={{ '--lyric-font-scale': settings.lyricFontSize / 100 } as CSSProperties}
    >
      <Background url={track?.album.images[0]?.url} theme={settings.theme} />
      <Settings
        settings={settings}
        onChange={updateSetting}
        offset={offset}
        setOffset={setOffset}
        onLogout={onSignedOut}
      />

      {track ? (
        <div className={`player-layout relative z-10 h-full ${lyricsVisible ? 'has-lyrics' : 'controls-only'}${controlsCollapsed ? ' controls-collapsed' : ''}`}>
          <div className={`controls-pane relative ${lyricsVisible ? '' : 'controls-only-pane'}`}>
            <Controls
              track={track}
              isPlaying={pb.isPlaying}
              getPosition={pb.getPosition}
              onToggle={pb.togglePlay}
              onNext={pb.next}
              onPrev={pb.previous}
              onSeek={pb.seek}
              vinyl={settings.vinyl}
              visualizer={settings.visualizer}
              reducedMotion={settings.reducedMotion}
              lyricsVisible={lyricsVisible}
              onToggleLyrics={toggleLyrics}
              queue={pb.queue}
              queueOpen={queueOpen}
              onToggleQueue={() => setQueueOpen((open) => !open)}
              onRefreshQueue={pb.refreshQueue}
            />
          </div>
          {lyricsVisible && <main className="lyrics-pane min-h-0">
            <div className={`lyrics-transition lyrics-${lyrics.phase}`}>
              <Lyrics
                status={lyrics.status}
                lyrics={lyrics.data}
                isPlaying={pb.isPlaying}
                getPosition={pb.getPosition}
                offset={offset}
                onSeek={pb.seek}
                onRetry={() => setRetryKey((k) => k + 1)}
              />
            </div>
          </main>}
          {lyricsVisible && (
            <button
              type="button"
              onClick={toggleControls}
              aria-label={controlsCollapsed ? 'Expand controls' : 'Collapse controls'}
              title={controlsCollapsed ? 'Expand controls' : 'Collapse controls'}
              aria-expanded={!controlsCollapsed}
              className={`panel-collapse ${controlsCollapsed ? 'panel-collapse-closed' : 'panel-collapse-open'}`}
            >
              <span aria-hidden="true">{controlsCollapsed ? '›' : '‹'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex h-full flex-col items-start justify-center gap-6 px-8 sm:px-16 lg:px-28">
          <h1 className="rise max-w-xl text-[clamp(2.5rem,7vw,5.5rem)] font-extrabold leading-[.95] tracking-[-0.04em]">
            {pb.loading ? 'Looking for your music…' : 'Nothing is playing.'}
          </h1>
          {!pb.loading && (
            <>
              <p className="max-w-md text-lg text-white/65">
                Start a song in Spotify and it will appear here.
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="rise fixed bottom-6 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl bg-[#1b1b25] px-5 py-4 text-sm shadow-2xl ring-1 ring-white/10">
          {error}
        </div>
      )}
    </div>
  )
}