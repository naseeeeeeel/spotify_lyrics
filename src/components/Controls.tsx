import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { useTime } from '../hooks/useTime'
import type { SpotifyTrack } from '../lib/types'

const fmt = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  )
}

function MicrophoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="rotate(-35 12 12)">
        <rect x="8" y="2" width="8" height="12" rx="4" />
        <path d="M8 7h8M8 10h8M12 14v6m-3 2h6" />
      </g>
    </svg>
  )
}

function Visualizer({ isPlaying, reducedMotion }: { isPlaying: boolean; reducedMotion: boolean }) {
  const bars = Array.from({ length: 32 }, (_, index) => {
    const height = 18 + Math.abs(Math.sin(index * 1.73) * Math.cos(index * 0.41)) * 76
    return (
      <span
        key={index}
        className="visualizer-bar"
        style={{ height: `${height}%`, animationDelay: `${-((index * 0.13) % 1.2)}s` }}
      />
    )
  })

  return (
    <div
      className={`visualizer${isPlaying && !reducedMotion ? ' is-playing' : ''}`}
      role="img"
      aria-label={isPlaying ? 'Music visualizer active' : 'Music visualizer paused'}
    >
      <div className="visualizer-bars" aria-hidden="true">{bars}</div>
    </div>
  )
}

function TrackTitle({ name, trackId }: { name: string; trackId: string }) {
  const viewport = useRef<HTMLHeadingElement>(null)
  const content = useRef<HTMLSpanElement>(null)
  const [marquee, setMarquee] = useState(false)

  useEffect(() => {
    const container = viewport.current
    const text = content.current
    if (!container || !text) return undefined

    const measure = () => setMarquee(text.scrollWidth > container.clientWidth + 2)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(text)
    return () => observer.disconnect()
  }, [name])

  return (
    <h1
      ref={viewport}
      className="track-title text-lg font-extrabold tracking-tight lg:text-3xl"
      title={name}
    >
      <a
        href={`https://open.spotify.com/track/${encodeURIComponent(trackId)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-inherit no-underline"
      >
        <span className={`track-title-track${marquee ? ' is-marquee' : ''}`}>
        <span ref={content} className="track-title-copy">{name}</span>
        {marquee && <span aria-hidden="true" className="track-title-copy">{name}</span>}
        </span>
      </a>
    </h1>
  )
}

function AlbumArt({ art, albumName }: { art?: string; albumName: string }) {
  const [images, setImages] = useState<{ current?: string; previous?: string; transitioning: boolean }>(() => ({
    current: art,
    transitioning: false,
  }))
  const currentArt = useRef(art)

  useEffect(() => {
    if (art === currentArt.current) return undefined
    const previous = currentArt.current
    currentArt.current = art
    setImages({ current: art, previous, transitioning: true })
    const timer = setTimeout(() => setImages({ current: art, transitioning: false }), 750)
    return () => clearTimeout(timer)
  }, [art])

  return (
    <>
      {images.previous && (
        <img
          aria-hidden="true"
          src={images.previous}
          className="album-art-image album-art-image-old"
          alt=""
        />
      )}
      {images.current && (
        <img
          key={images.current}
          src={images.current}
          alt={`${albumName} cover`}
          className={`album-art-image album-art-image-current${images.transitioning ? ' is-changing' : ''}`}
        />
      )}
    </>
  )
}

const PLAY = 'M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z'
const PAUSE = 'M7 4h3.5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm6.5 0H17a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'
const NEXT = 'M5 5.2v13.6a.8.8 0 0 0 1.25.66l9-6.8a.8.8 0 0 0 0-1.32l-9-6.8A.8.8 0 0 0 5 5.2zM17 5h2v14h-2z'
const PREV = 'M19 5.2v13.6a.8.8 0 0 1-1.25.66l-9-6.8a.8.8 0 0 1 0-1.32l9-6.8A.8.8 0 0 1 19 5.2zM5 5h2v14H5z'
const QUEUE = 'M3 5h18v2H3zm0 6h18v2H3zm0 6h12v2H3zm15 0 4 3-4 3z'

interface ProgressProps {
  getPosition: () => number
  duration: number
  onSeek: (ms: number) => void
}

function Progress({ getPosition, duration, onSeek }: ProgressProps) {
  const pos = useTime(getPosition)
  const pct = duration ? (pos / duration) * 100 : 0

  const handle = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek(((e.clientX - rect.left) / rect.width) * duration)
  }

  return (
    <div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(pos)}
        onClick={handle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(Math.min(duration, pos + 5000))
          if (e.key === 'ArrowLeft') onSeek(Math.max(0, pos - 5000))
        }}
        className="group flex h-4 cursor-pointer items-center"
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/20 transition-all group-hover:h-1.5">
          <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-white/60">
        <span>{fmt(pos)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  )
}

interface ControlsProps {
  track: SpotifyTrack
  isPlaying: boolean
  getPosition: () => number
  onToggle: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (ms: number) => void
  vinyl: boolean
  visualizer: boolean
  reducedMotion: boolean
  lyricsVisible: boolean
  onToggleLyrics: () => void
  queue: { tracks: SpotifyTrack[]; loading: boolean; error: string | null }
  queueOpen: boolean
  onToggleQueue: () => void
  onRefreshQueue: () => void
}

export default function Controls({
  track, isPlaying, getPosition,
  onToggle, onNext, onPrev, onSeek, vinyl, visualizer, reducedMotion, lyricsVisible, onToggleLyrics,
  queue, queueOpen, onToggleQueue, onRefreshQueue,
}: ControlsProps) {
  const art = track.album.images[0]?.url

  return (
    <section className="flex flex-col justify-center gap-4 p-5 lg:gap-8 lg:p-12">
      <div className="flex items-center gap-4 lg:flex-col lg:items-stretch lg:gap-8">
        <div
          className={`album-art-frame rise relative aspect-square h-16 w-16 shrink-0 lg:h-auto lg:w-full lg:max-w-[380px]${isPlaying ? ' is-playing' : ''}${vinyl ? ' is-vinyl' : ''}`}
          onPointerMove={(e) => {
            if (e.pointerType !== 'mouse' || vinyl) return
            const rect = e.currentTarget.getBoundingClientRect()
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
            const y = ((e.clientY - rect.top) / rect.height) * 2 - 1
            e.currentTarget.style.setProperty('--tilt-x', `${-y * 16}deg`)
            e.currentTarget.style.setProperty('--tilt-y', `${x * 16}deg`)
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.setProperty('--tilt-x', '0deg')
            e.currentTarget.style.setProperty('--tilt-y', '0deg')
          }}
          style={{ transform: 'perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))' }}
        >
          {vinyl && (
            <div className="vinyl-disc" style={{ '--record-label': art ? `url("${art}")` : 'none' } as CSSProperties} aria-hidden="true">
              <span className="vinyl-label" />
              <span className="vinyl-spindle" />
            </div>
          )}
          <div className={`album-sleeve${vinyl ? ' is-vinyl-sleeve' : ''}`}>
            <AlbumArt art={art} albumName={track.album.name} />
          </div>
          {vinyl && <span aria-hidden="true" className="vinyl-tonearm"><span /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="track-title-visualizer">
            {visualizer && <Visualizer isPlaying={isPlaying} reducedMotion={reducedMotion} />}
            <TrackTitle name={track.name} trackId={track.id} />
          </div>
          <p className="truncate text-sm text-white/65 lg:mt-1 lg:text-lg">
            {track.artists.map((artist, index) => (
              <span key={artist.id}>
                {index > 0 && ', '}
                <a
                  href={`https://open.spotify.com/artist/${encodeURIComponent(artist.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white hover:underline hover:underline-offset-4"
                >
                  {artist.name}
                </a>
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="lg:max-w-[380px]">
        <Progress getPosition={getPosition} duration={track.duration_ms} onSeek={onSeek} />

        <div className="mt-2 flex items-center justify-center lg:mt-4">
          <div className="flex w-full items-center justify-center gap-1.5 sm:gap-2">
            <button onClick={onPrev} aria-label="Previous" className="transport-button flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-90">
              <Icon d={PREV} />
            </button>
            <button
              onClick={onToggle}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="play-button flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 active:scale-90"
            >
              <Icon d={isPlaying ? PAUSE : PLAY} size={26} />
            </button>
            <button onClick={onNext} aria-label="Next" className="transport-button flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-90">
              <Icon d={NEXT} />
            </button>
            <button
              onClick={onToggleQueue}
              aria-label={queueOpen ? 'Hide queue' : 'Show queue'}
              aria-expanded={queueOpen}
              aria-controls="spotify-queue-panel"
              title={queueOpen ? 'Hide queue' : 'Show queue'}
              className={`transport-button flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-90 ${
                queueOpen ? 'bg-white/15 text-white' : 'text-white/60'
              }`}
            >
              <Icon d={QUEUE} size={21} />
            </button>
            <button
              onClick={onToggleLyrics}
              aria-label={lyricsVisible ? 'Hide lyrics' : 'Show lyrics'}
              aria-pressed={lyricsVisible}
              title={lyricsVisible ? 'Hide lyrics' : 'Show lyrics'}
              className={`lyrics-toggle ml-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${
                lyricsVisible ? 'bg-white/15 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
              }`}
            >
              <MicrophoneIcon />
            </button>
          </div>
        </div>

        <div
          id="spotify-queue-panel"
          className={`queue-panel${queueOpen ? ' is-open' : ''}`}
          aria-hidden={!queueOpen}
        >
          <div className="queue-panel-inner">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Up next</h2>
              <button
                type="button"
                onClick={onRefreshQueue}
                disabled={queue.loading}
                className="rounded px-2 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                Refresh
              </button>
            </div>
            <div className="queue-track-list no-scrollbar">
              {queue.error && (
                <div className="mb-2 rounded-lg bg-white/5 p-3 text-xs text-white/70" role="alert">
                  <p>{queue.error}</p>
                  <button type="button" onClick={onRefreshQueue} className="mt-2 text-white underline underline-offset-2">
                    Try again
                  </button>
                </div>
              )}
              {queue.loading && queue.tracks.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/50">Loading queue…</p>
              ) : queue.tracks.length > 0 ? (
                queue.tracks.map((queuedTrack, index) => (
                  <div key={`${queuedTrack.id}-${index}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/5">
                    {queuedTrack.album.images[0]?.url ? (
                      <img src={queuedTrack.album.images[0].url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                    ) : (
                      <div aria-hidden="true" className="h-10 w-10 shrink-0 rounded bg-white/10" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{queuedTrack.name}</p>
                      <p className="truncate text-xs text-white/55">
                        {queuedTrack.artists.map((artist, artistIndex) => (
                          <span key={artist.id}>
                            {artistIndex > 0 && ', '}
                            <a
                              href={`https://open.spotify.com/artist/${encodeURIComponent(artist.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-white hover:underline"
                            >
                              {artist.name}
                            </a>
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                ))
              ) : !queue.error && !queue.loading ? (
                <p className="py-4 text-center text-sm text-white/50">No upcoming songs.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
