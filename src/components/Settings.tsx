import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { FONT_OPTIONS } from '../lib/settings'
import type { PlayerSettings, PlayerTheme } from '../lib/settings'

interface SettingsProps {
  settings: PlayerSettings
  onChange: <K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) => void
  offset: number
  setOffset: (offset: number) => void
  onLogout: () => void
}

interface SelectOption<T extends string> {
  value: T
  label: string
}

function SettingsSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)

  useEffect(() => {
    if (open) optionRefs.current[selectedIndex]?.focus()
  }, [open, selectedIndex])

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
    }
  }

  const onOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      optionRefs.current[(index + step + options.length) % options.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      optionRefs.current[event.key === 'Home' ? 0 : options.length - 1]?.focus()
    }
  }

  const currentLabel = options[selectedIndex]?.label ?? ''

  return (
    <div className="settings-field">
      <span>{label}</span>
      <div className="settings-select-wrap">
        <button
          ref={trigger}
          type="button"
          className="settings-select"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
          onKeyDown={onTriggerKeyDown}
        >
          <span>{currentLabel}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>
        {open && (
          <div className="settings-options" role="listbox" aria-label={label}>
            {options.map((option, index) => (
              <button
                key={option.value}
                ref={(element) => { optionRefs.current[index] = element }}
                type="button"
                role="option"
                aria-selected={value === option.value}
                className="settings-option"
                onClick={() => {
                  onChange(option.value)
                  close()
                }}
                onKeyDown={(event) => onOptionKeyDown(event, index)}
                onBlur={(event) => {
                  if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
                    setOpen(false)
                  }
                }}
              >
                {option.label}
                {value === option.value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const THEME_OPTIONS: { value: PlayerTheme; label: string }[] = [
  { value: 'album', label: 'Lyrica' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'rose', label: 'Rose' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'forest', label: 'Forest' },
  { value: 'amber', label: 'Amber' },
]

export default function Settings({ settings, onChange, offset, setOffset, onLogout }: SettingsProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={root} className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        aria-controls="player-settings"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#111118]/80 text-white/75 shadow-xl backdrop-blur-xl transition hover:bg-white/15 hover:text-white"
      >
        <Icon d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.08-.03a1.7 1.7 0 0 0-1.83.35l-.06.06h-3.4l-.02-.08a1.7 1.7 0 0 0-1.3-1.3l-.08-.02-2.94 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34l-.08.03-1.7-2.94.06-.06A1.7 1.7 0 0 0 5 15.36l-.03-.08v-3.4l.08-.02a1.7 1.7 0 0 0 1.3-1.3l.02-.08-1.7-2.94.06-.06a1.7 1.7 0 0 0 .34-1.88l-.03-.08 2.94-1.7.06.06a1.7 1.7 0 0 0 1.83.35l.08-.03h3.4l.02.08a1.7 1.7 0 0 0 1.3 1.3l.08.02 2.94-1.7.06.06a1.7 1.7 0 0 0 1.88.34l.08-.03 1.7 2.94-.06.06a1.7 1.7 0 0 0-.34 1.88l.03.08v3.4l-.08.02a1.7 1.7 0 0 0-1.3 1.3l-.02.08Z" />
      </button>

      {open && (
        <section
          id="player-settings"
          aria-label="Player settings"
          className="settings-popover mt-3 w-[min(88vw,21rem)] rounded-2xl border border-white/10 bg-[#111118]/95 p-5 text-white shadow-2xl backdrop-blur-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Appearance</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close settings" className="rounded-full px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white">✕</button>
          </div>

          <SettingsSelect
            label="Font"
            value={settings.font}
            options={FONT_OPTIONS}
            onChange={(font) => onChange('font', font)}
          />

          <SettingsSelect
            label="Theme"
            value={settings.theme}
            options={THEME_OPTIONS}
            onChange={(theme) => onChange('theme', theme)}
          />

          <label className="settings-toggle mt-4">
            <span>Rotating vinyl artwork</span>
            <input
              type="checkbox"
              checked={settings.vinyl}
              onChange={(event) => onChange('vinyl', event.target.checked)}
              className="h-4 w-4 accent-white"
            />
          </label>

          <label className="settings-size-control">
            <span>Lyric size <output>{settings.lyricFontSize}%</output></span>
            <input
              type="range"
              min="80"
              max="150"
              step="10"
              value={settings.lyricFontSize}
              onChange={(event) => onChange('lyricFontSize', Number(event.target.value))}
              aria-label="Lyric font size"
              style={{ '--range-progress': `${((settings.lyricFontSize - 80) / 70) * 100}%` } as CSSProperties}
            />
          </label>

          <label className="settings-toggle">
            <span>Compact layout</span>
            <input
              type="checkbox"
              checked={settings.compactLayout}
              onChange={(event) => onChange('compactLayout', event.target.checked)}
            />
          </label>
          <label className="settings-toggle">
            <span>Visualizer</span>
            <input
              type="checkbox"
              checked={settings.visualizer}
              onChange={(event) => onChange('visualizer', event.target.checked)}
            />
          </label>
          <label className="settings-toggle">
            <span>Reduce motion</span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) => onChange('reducedMotion', event.target.checked)}
            />
          </label>

          <div className="settings-shortcuts">
            <h3>Keyboard shortcuts</h3>
            <p><kbd>Space</kbd> Play / pause</p>
            <p><kbd>←</kbd> <kbd>→</kbd> Seek 5 seconds</p>
            <p><kbd>↑</kbd> <kbd>↓</kbd> Previous / next track</p>
            <p><kbd>L</kbd> Lyrics <kbd>Q</kbd> Queue</p>
          </div>

          <div className="settings-timing">
            <span className="settings-timing-label">Lyrics timing</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOffset(offset - 100)}
                aria-label="Show lyrics later"
                className="settings-stepper"
              >−</button>
              <span className="min-w-16 text-center text-xs tabular-nums text-white/70">
                {offset > 0 ? '+' : ''}{offset} ms
              </span>
              <button
                type="button"
                onClick={() => setOffset(offset + 100)}
                aria-label="Show lyrics earlier"
                className="settings-stepper"
              >+</button>
            </div>
          </div>
          <button type="button" onClick={onLogout} className="settings-signout">
            Sign out of Spotify
          </button>
        </section>
      )}
    </div>
  )
}
