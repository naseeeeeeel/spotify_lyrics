import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTime } from '../hooks/useTime'
import type { LyricsData, LyricsStatus, LyricWord, PlainLine, SyncedLine, SyncedLyrics } from '../lib/types'
import { getLyricAccent, getLyricAccentWordIndex } from '../lib/lyricAccents'
import { Bars } from 'react-loader-spinner'

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))
const LINE_CHANGE_DELAY_MS = 180
const normalizeLyricWord = (text: string) => text.toLocaleLowerCase().replace(/[^a-z]/g, '')

function isHeartbreakWord(words: LyricWord[], index: number): boolean {
  const word = normalizeLyricWord(words[index].text)
  if (word === 'heartbreak') return true
  const previous = index > 0 ? normalizeLyricWord(words[index - 1].text) : ''
  const next = index < words.length - 1 ? normalizeLyricWord(words[index + 1].text) : ''
  return (word === 'heart' && next === 'break') || (word === 'break' && previous === 'heart')
}

const MONEY_WORDS = new Set([
  'rack', 'racks', 'money', 'cash', 'dollar', 'dollars', 'buck', 'bucks', 'band', 'bands',
  'bread', 'dough', 'guap', 'cheddar', 'paper', 'bill', 'bills', 'stack', 'stacks',
  'bankroll', 'bag', 'bags', 'coin', 'coins', 'currency', 'rich', 'richer', 'riches',
  'wealth', 'wealthy', 'millionaire', 'millionaires',
])
const LYRIC_COLORS: Record<string, string> = {
  red: '#ff4545',
  orange: '#ff9a35',
  yellow: '#ffe34d',
  green: '#43e879',
  blue: '#4d9dff',
  purple: '#bc78ff',
  pink: '#ff79c6',
  black: '#15151a',
  white: '#ffffff',
  brown: '#b8794b',
  gray: '#a3a3ad',
  grey: '#a3a3ad',
  gold: '#ffd34d',
  golden: '#ffd34d',
  silver: '#d8dce8',
  teal: '#43dfcf',
  cyan: '#4ce7ff',
  indigo: '#7476ff',
  violet: '#a56bff',
  crimson: '#ed3154',
  scarlet: '#ff3c46',
  turquoise: '#40e0d0',
  magenta: '#ff45df',
}

function Word({ word, time }: { word: LyricWord; time: number }) {
  const p = clamp01((time - word.start) / (word.end - word.start))
  const singing = p > 0 && p < 1
  const color = LYRIC_COLORS[word.text.toLocaleLowerCase().replace(/[^a-z]/g, '')]
  // Map 0..1 onto -8%..108% so the soft edge fully enters and exits the word.
  return (
    <span
      className={`word${singing ? ' singing' : ''}`}
      style={{
        '--p': `${p * 116 - 8}%`,
        ...(color && singing ? { backgroundImage: `linear-gradient(90deg, ${color}, ${color})` } : {}),
      } as CSSProperties}
    >
      {word.text}
    </span>
  )
}

function MusicNote({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M37 10v34.5a9.5 9.5 0 1 1-5-8.4V18l22-5v26.5a9.5 9.5 0 1 1-5-8.4V7l-12 3Z" fill="currentColor" />
    </svg>
  )
}

function Interlude({ line, time, active }: { line: SyncedLine; time: number; active: boolean }) {
  const p = active ? clamp01((time - line.time) / Math.max(1, line.end - line.time)) : 0
  return (
    <div className="flex h-12 items-center gap-3" style={{ opacity: active ? 1 : 0, transition: 'opacity .5s' }}>
      {[0, 1, 2].map((i) => {
        const fill = clamp01(p * 3 - i)
        return (
          <span
            key={i}
            className="dot"
            style={{ opacity: 0.25 + fill * 0.75, transform: `scale(${0.8 + fill * 0.35})` }}
          />
        )
      })}
    </div>
  )
}

interface LineProps {
  line: SyncedLine
  index: number
  active: boolean
  distance: number
  time: number
  onSeek: (ms: number) => void
  register: (index: number, el: HTMLDivElement | null) => void
}

const Line = memo(function Line({ line, index, active, distance, time, onSeek, register }: LineProps) {
  const empty = !line.text
  const accent = active && !empty ? getLyricAccent(line.text) : undefined
  const accentWordIndex = accent
    ? getLyricAccentWordIndex(line.words.map((word) => word.text), accent.term)
    : -1
  const style: CSSProperties = active
    ? { opacity: 1 }
    : { opacity: Math.max(0.2, 0.55 - distance * 0.08), filter: `blur(${Math.min(distance, 5) * 0.7}px)` }

  return (
    <div
      ref={(el) => {
        register(index, el)
      }}
      className="relative isolate py-[.35em]"
    >
      {empty ? (
        <Interlude line={line} time={time} active={active} />
      ) : (
        <>
          <p
            className={`line text-[clamp(1.9rem,4.2vw,3.6rem)] font-extrabold leading-[1.08] tracking-[-0.03em]${active ? ' line-active' : ''}`}
            style={{
              ...style,
              transform: active ? 'scale(1)' : 'scale(.94)',
              fontSize: 'calc(clamp(1.9rem, 4.2vw, 3.6rem) * var(--lyric-font-scale, 1))',
            }}
            onClick={() => onSeek(line.time)}
          >
            {active
              ? line.words.map((w, i) => (
                  <Fragment key={i}>
                      <span
                        className={[
                          i === accentWordIndex && accent ? 'lyric-accent-word' : '',
                          normalizeLyricWord(w.text) === 'love' ? 'lyric-love-word' : '',
                          normalizeLyricWord(w.text) === 'devil' ? 'lyric-devil-word' : '',
                                                    normalizeLyricWord(w.text) === 'satan' ? 'lyric-devil-word' : '',

                          MONEY_WORDS.has(normalizeLyricWord(w.text)) ? 'lyric-money-word' : '',
                          isHeartbreakWord(line.words, i) && time >= w.start && time < w.end ? 'lyric-heartbreak-word' : '',
                        ].filter(Boolean).join(' ') || undefined}
                      >
                      <Word word={w} time={time} />
                      {i === accentWordIndex && accent && (
                        <img
                          aria-hidden="true"
                          alt=""
                          className="lyric-word-accent"
                          src={`data:image/svg+xml,${encodeURIComponent(accent.svg.replace(/currentColor/g, '#f5f1ff'))}`}
                        />
                      )}
                    </span>
                    {' '}
                  </Fragment>
                ))
              : line.text}
          </p>
        </>
      )}
    </div>
  )
})

function Message({ children , className}: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex h-full items-center px-8 lg:px-16 ${className || ''}`}>
      <p className="rise max-w-sm text-2xl font-semibold leading-snug text-white/60">{children}</p>
    </div>
  )
}

interface LyricsProps {
  status: LyricsStatus
  lyrics: LyricsData | null
  isPlaying: boolean
  getPosition: () => number
  offset: number
  onSeek: (ms: number) => void
  onRetry: () => void
}

export default function Lyrics({ status, lyrics, isPlaying, getPosition, offset, onSeek, onRetry }: LyricsProps) {
  // center it
  if (status === 'loading') return <Message className="justify-center">
    <div className="lyrics-loader" role="status" aria-label="Loading lyrics">
      <Bars
        height="80"
        width="80"
        color="var(--theme-accent, #f5f1ff)"
        ariaLabel="bars-loading"
        wrapperStyle={{}}
        wrapperClass=""
        visible={true}
      />
    </div>
  </Message>
  if (status === 'error') {
    return (
      <Message>
        Couldn’t reach the lyrics service.
        <button
          onClick={onRetry}
          className="mt-5 block rounded-full bg-white px-6 py-3 text-base font-semibold text-black transition hover:scale-[1.03] active:scale-95"
        >
          Try again
        </button>
      </Message>
    )
  }
  if (!lyrics) return <Message>No lyrics found for this track.</Message>
  if (!lyrics.synced) return <PlainLyrics lines={lyrics.lines} />
  return <Synced lyrics={lyrics} isPlaying={isPlaying} getPosition={getPosition} offset={offset} onSeek={onSeek} />
}

function PlainLyrics({ lines }: { lines: PlainLine[] }) {
  return (
    <div className="no-scrollbar fade-mask h-full overflow-y-auto px-8 py-[20vh] lg:px-16">
      <p className="mb-8 text-sm text-white/50">These lyrics aren’t timed, so they won’t follow the song.</p>
      {lines.map((l, i) => {
        return (
          <div key={i} className="py-[.2em]">
            <p className="plain-lyric-text font-bold leading-tight tracking-tight text-white/85">
              {l.text || '\u00A0'}
            </p>
          </div>
        )
      })}
    </div>
  )
}

interface SyncedProps {
  lyrics: SyncedLyrics
  isPlaying: boolean
  getPosition: () => number
  offset: number
  onSeek: (ms: number) => void
}

function Synced({ lyrics, isPlaying, getPosition, offset, onSeek }: SyncedProps) {
  const raw = useTime(getPosition)
  const time = Math.max(0, raw + offset - LINE_CHANGE_DELAY_MS)
  const lines = lyrics.lines
  const box = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const userScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [userScrolling, setUserScrolling] = useState(false)

  const anchorIndex = useMemo(() => {
    let idx = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= time) idx = i
      else break
    }
    return idx
  }, [lines, time])
  const activeIndex = anchorIndex >= 0 && lines[anchorIndex].text ? anchorIndex : -1
  const [gapConfirmed, setGapConfirmed] = useState(false)
  const gapActive = anchorIndex >= 0 && (
    !lines[anchorIndex].text ||
    time >= (lines[anchorIndex].words.at(-1)?.end ?? lines[anchorIndex].end)
  )

  useEffect(() => {
    setGapConfirmed(false)
    if (!isPlaying || !gapActive) return undefined

    const timer = setTimeout(() => setGapConfirmed(true), 1200)
    return () => clearTimeout(timer)
  }, [anchorIndex, gapActive, isPlaying])

  const showGapNote = gapConfirmed && isPlaying && gapActive

  const pauseAutoScroll = useCallback(() => {
    setUserScrolling(true)
    if (userScrollTimer.current) clearTimeout(userScrollTimer.current)
    userScrollTimer.current = setTimeout(() => {
      userScrollTimer.current = null
      setUserScrolling(false)
    }, 1000)
  }, [])

  useEffect(() => () => {
    if (userScrollTimer.current) clearTimeout(userScrollTimer.current)
  }, [])

  useEffect(() => {
    const c = box.current
    if (!c || userScrolling) return undefined
    if (anchorIndex < 0) {
      c.scrollTo({ top: 0, behavior: 'smooth' })
      return undefined
    }
    const el = refs.current[anchorIndex]
    if (el) {
      c.scrollTo({
        top: el.offsetTop - c.clientHeight * 0.36 + el.offsetHeight / 2,
        behavior: 'smooth',
      })
    }
    return undefined
  }, [anchorIndex, userScrolling])

  // Stable callbacks so memoized lines don't re-render every frame.
  const register = useCallback((i: number, el: HTMLDivElement | null) => {
    refs.current[i] = el
  }, [])
  const offsetRef = useRef(offset)
  offsetRef.current = offset
  const onSeekRef = useRef(onSeek)
  onSeekRef.current = onSeek
  // Jump to a line: subtract the sync offset so the clock lands on that line.
  const seekTo = useCallback((ms: number) => onSeekRef.current(Math.max(0, ms - offsetRef.current)), [])

  return (
    <div className="lyrics-scroll-shell relative h-full">
      <div
        className={`lyrics-music-backdrop${showGapNote ? ' is-visible' : ''}`}
        role="img"
        aria-label="Music is playing"
        aria-hidden={!showGapNote}
      >
        <MusicNote className="no-lyric-music" />
      </div>
      <div
        ref={box}
        onWheel={pauseAutoScroll}
        onTouchMove={pauseAutoScroll}
        className="no-scrollbar fade-mask relative z-[1] h-full overflow-y-auto px-8 lg:px-16"
      >
        <div className="h-[34vh]" />
        {lines.map((line, i) => (
          <Line
            key={i}
            index={i}
            line={line}
            active={i === activeIndex}
            distance={Math.abs(i - anchorIndex)}
            time={i === activeIndex ? time : 0}
            onSeek={seekTo}
            register={register}
          />
        ))}
        <div className="h-[50vh]" />
      </div>
    </div>
  )
}