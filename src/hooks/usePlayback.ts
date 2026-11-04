import { useCallback, useEffect, useRef, useState } from 'react'
import * as sp from '../lib/spotify'
import { SpotifyError } from '../lib/spotify'
import type { SpotifyDevice, SpotifyTrack } from '../lib/types'

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const PLAYBACK_INTENT_GRACE_MS = 5000

function describe(err: unknown): string {
  if (!(err instanceof SpotifyError)) {
    return err instanceof Error ? err.message : 'Something went wrong.'
  }
  if (err.reason === 'PREMIUM_REQUIRED') return 'Changing playback needs Spotify Premium.'
  if (err.status === 403) return `Spotify refused the request: ${err.message}`
  if (err.status === 404) return err.message
  if (err.status === 429) return 'Spotify is rate-limiting requests. Try again in a moment.'
  return err.message
}

interface PlayerState {
  loading: boolean
  track: SpotifyTrack | null
  isPlaying: boolean
  device: SpotifyDevice | null
}

interface QueueState {
  tracks: SpotifyTrack[]
  loading: boolean
  error: string | null
}

interface Anchor {
  progress: number
  at: number
  playing: boolean
  duration: number
}

interface PlaybackIntent {
  isPlaying: boolean
  until: number
}

export interface PlaybackApi extends PlayerState {
  error: string | null
  transitioning: boolean
  queue: QueueState
  clearError: () => void
  refreshQueue: () => Promise<void>
  getPosition: () => number
  togglePlay: () => void
  seek: (ms: number) => void
  next: () => void
  previous: () => void
}

export function usePlayback({ onSignedOut, queueOpen }: { onSignedOut: () => void; queueOpen: boolean }): PlaybackApi {
  const [state, setState] = useState<PlayerState>({
    loading: true,
    track: null,
    isPlaying: false,
    device: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [queue, setQueue] = useState<QueueState>({ tracks: [], loading: false, error: null })
  const anchor = useRef<Anchor>({ progress: 0, at: performance.now(), playing: false, duration: 0 })
  const skipPending = useRef<{ trackId: string | null; until: number } | null>(null)
  // Keep the user's immediate play/pause choice while Spotify's state catches up.
  const playbackIntent = useRef<PlaybackIntent | null>(null)

  const setAnchor = (progress: number, playing: boolean, duration: number) => {
    anchor.current = { progress, at: performance.now(), playing, duration }
  }

  // Interpolated position between polls, so lyrics move at 60fps.
  const getPosition = useCallback((): number => {
    const a = anchor.current
    const pos = a.progress + (a.playing ? performance.now() - a.at : 0)
    return a.duration ? Math.min(pos, a.duration) : pos
  }, [])

  const poll = useCallback(async () => {
    const data = await sp.getPlayback()

    const transition = skipPending.current
    if (transition) {
      if (Date.now() < transition.until && data?.item?.id === transition.trackId) return
      skipPending.current = null
    }

    const intent = playbackIntent.current
    if (intent) {
      if (data?.is_playing === intent.isPlaying) playbackIntent.current = null
      else if (Date.now() < intent.until) return
      else playbackIntent.current = null
    }

    if (!data || !data.item || data.currently_playing_type === 'ad') {
      anchor.current = { ...anchor.current, playing: false }
      setState({ loading: false, track: null, isPlaying: false, device: data?.device ?? null })
      return
    }
    setAnchor(data.progress_ms ?? 0, data.is_playing, data.item.duration_ms)
    setState({ loading: false, track: data.item, isPlaying: data.is_playing, device: data.device })
  }, [])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const loop = async () => {
      let delay = 2000
      try {
        await poll()
      } catch (err) {
        if (err instanceof SpotifyError && err.status === 401) {
          onSignedOut()
          return
        }
        if (err instanceof SpotifyError && err.status === 429) delay = (err.retryAfter || 5) * 1000
        else setState((s) => ({ ...s, loading: false }))
      }
      if (!stopped) timer = setTimeout(loop, delay)
    }
    void loop()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [poll, onSignedOut])

  const run = useCallback(
    async (fn: () => Promise<unknown>): Promise<void> => {
      try {
        await fn()
      } catch (err) {
        if (err instanceof SpotifyError && err.status === 401) {
          onSignedOut()
          return
        }
        setError(describe(err))
      }
    },
    [onSignedOut]
  )

  const refreshQueue = useCallback(async () => {
    setQueue((current) => ({ ...current, loading: true, error: null }))
    try {
      const data = await sp.getQueue()
      const tracks = (data?.queue ?? []).filter(
        (track) => track.type !== 'episode' && Array.isArray(track.artists) && Array.isArray(track.album?.images),
      )
      setQueue({ tracks, loading: false, error: null })
    } catch (err) {
      if (err instanceof SpotifyError && err.status === 401) {
        onSignedOut()
        return
      }
      setQueue((current) => ({ ...current, loading: false, error: describe(err) }))
    }
  }, [onSignedOut])

  useEffect(() => {
    if (!queueOpen) return undefined

    void refreshQueue()
    const timer = setInterval(() => void refreshQueue(), 15000)
    return () => clearInterval(timer)
  }, [queueOpen, state.track?.id, refreshQueue])

  const togglePlay = useCallback(() => {
    const a = anchor.current
    const playing = !a.playing
    playbackIntent.current = { isPlaying: playing, until: Date.now() + PLAYBACK_INTENT_GRACE_MS }
    setAnchor(getPosition(), playing, a.duration)
    setState((s) => ({ ...s, isPlaying: playing }))
    void run(async () => {
      try {
        await (playing ? sp.resume() : sp.pause())
      } catch (err) {
        playbackIntent.current = null
        void poll().catch(() => undefined)
        throw err
      }
    })
  }, [getPosition, poll, run])

  const seek = useCallback(
    (ms: number) => {
      const a = anchor.current
      setAnchor(ms, a.playing, a.duration)
      void run(() => sp.seek(ms))
    },
    [run]
  )

  const skip = useCallback(
    (dir: 1 | -1) => {
      setTransitioning(true)
      skipPending.current = { trackId: state.track?.id ?? null, until: Date.now() + 6000 }
      const position = getPosition()
      setAnchor(position, false, anchor.current.duration)
      setState((current) => ({ ...current, isPlaying: false }))
      void run(async () => {
        try {
          await (dir > 0 ? sp.next() : sp.previous())
          for (const delay of [500, 750, 1000, 1500, 2000]) {
            if (!skipPending.current) break
            await wait(delay)
            if (!skipPending.current) break
            await poll()
          }
          if (skipPending.current) {
            skipPending.current = null
            await poll()
          }
        } finally {
          skipPending.current = null
          setTransitioning(false)
        }
      })
    },
    [getPosition, run, poll, state.track?.id]
  )

  const clearError = useCallback(() => setError(null), [])
  const next = useCallback(() => skip(1), [skip])
  const previous = useCallback(() => {
    if (getPosition() > 3000) seek(0)
    else skip(-1)
  }, [getPosition, seek, skip])

  return {
    ...state,
    error,
    transitioning,
    queue,
    clearError,
    refreshQueue,
    getPosition,
    togglePlay,
    seek,
    next,
    previous,
  }
}