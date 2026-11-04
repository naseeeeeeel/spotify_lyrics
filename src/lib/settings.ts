export type PlayerFont =
  | 'bricolage'
  | 'inter'
  | 'dm-sans'
  | 'manrope'
  | 'outfit'
  | 'space-grotesk'
  | 'playfair-display'
  | 'lora'
  | 'ibm-plex-mono'
  | 'system'
  | 'serif'
  | 'mono'
export type PlayerTheme = 'album' | 'midnight' | 'rose' | 'ocean' | 'forest' | 'amber'

export const FONT_OPTIONS: { value: PlayerFont; label: string; family: string; googleFamily?: string }[] = [
  { value: 'bricolage', label: 'Bricolage Grotesque', family: '"Bricolage Grotesque"', googleFamily: 'Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800' },
  { value: 'inter', label: 'Inter', family: 'Inter', googleFamily: 'Inter:wght@400;600;800' },
  { value: 'dm-sans', label: 'DM Sans', family: '"DM Sans"', googleFamily: 'DM+Sans:wght@400;600;800' },
  { value: 'manrope', label: 'Manrope', family: 'Manrope', googleFamily: 'Manrope:wght@400;600;800' },
  { value: 'outfit', label: 'Outfit', family: 'Outfit', googleFamily: 'Outfit:wght@400;600;800' },
  { value: 'space-grotesk', label: 'Space Grotesk', family: '"Space Grotesk"', googleFamily: 'Space+Grotesk:wght@400;600;700' },
  { value: 'playfair-display', label: 'Playfair Display', family: '"Playfair Display"', googleFamily: 'Playfair+Display:wght@400;600;800' },
  { value: 'lora', label: 'Lora', family: 'Lora', googleFamily: 'Lora:wght@400;600;700' },
  { value: 'ibm-plex-mono', label: 'IBM Plex Mono', family: '"IBM Plex Mono"', googleFamily: 'IBM+Plex+Mono:wght@400;600' },
  { value: 'system', label: 'System', family: 'ui-sans-serif, system-ui, sans-serif' },
  { value: 'serif', label: 'Serif', family: 'Georgia, "Times New Roman", serif' },
  { value: 'mono', label: 'Monospace', family: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
]

export function loadGoogleFont(font: PlayerFont): void {
  const option = FONT_OPTIONS.find(({ value }) => value === font)
  let link = document.getElementById('lyrica-google-font') as HTMLLinkElement | null

  if (!option?.googleFamily) {
    link?.remove()
    return
  }

  if (!link) {
    link = document.createElement('link')
    link.id = 'lyrica-google-font'
    link.rel = 'stylesheet'
  }

  link.href = `https://fonts.googleapis.com/css2?family=${option.googleFamily}&display=swap`
  if (!link.isConnected) document.head.append(link)
}

export interface PlayerSettings {
  font: PlayerFont
  theme: PlayerTheme
  vinyl: boolean
  lyricFontSize: number
  compactLayout: boolean
  visualizer: boolean
  reducedMotion: boolean
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  font: 'bricolage',
  theme: 'album',
  vinyl: false,
  lyricFontSize: 100,
  compactLayout: false,
  visualizer: true,
  reducedMotion: false,
}

const STORAGE_KEY = 'lyrica_settings'

export function loadSettings(): PlayerSettings {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return DEFAULT_SETTINGS

  try {
    const value: unknown = JSON.parse(saved)
    if (!value || typeof value !== 'object') return DEFAULT_SETTINGS
    const settings = value as Partial<PlayerSettings>
    return {
      font: FONT_OPTIONS.some(({ value }) => value === settings.font)
        ? settings.font as PlayerFont
        : DEFAULT_SETTINGS.font,
      theme: ['album', 'midnight', 'rose', 'ocean', 'forest', 'amber'].includes(settings.theme ?? '')
        ? settings.theme as PlayerTheme
        : DEFAULT_SETTINGS.theme,
      vinyl: typeof settings.vinyl === 'boolean' ? settings.vinyl : DEFAULT_SETTINGS.vinyl,
      lyricFontSize: typeof settings.lyricFontSize === 'number' && settings.lyricFontSize >= 80 && settings.lyricFontSize <= 150
        ? Math.round(settings.lyricFontSize / 10) * 10
        : DEFAULT_SETTINGS.lyricFontSize,
      compactLayout: typeof settings.compactLayout === 'boolean' ? settings.compactLayout : DEFAULT_SETTINGS.compactLayout,
      visualizer: typeof settings.visualizer === 'boolean' ? settings.visualizer : DEFAULT_SETTINGS.visualizer,
      reducedMotion: typeof settings.reducedMotion === 'boolean' ? settings.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: PlayerSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
