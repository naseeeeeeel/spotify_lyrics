import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PlayerTheme } from '../lib/settings'

interface Palette {
  c1: string
  c2: string
  c3: string
}

interface Layer {
  id: number
  colors: Palette
  artworkUrl: string | null
}

const DEFAULT: Palette = { c1: 'hsl(265 70% 42%)', c2: 'hsl(330 70% 45%)', c3: 'hsl(205 80% 40%)' }
const THEMES: Record<Exclude<PlayerTheme, 'album'>, Palette> = {
  midnight: { c1: 'hsl(252 42% 34%)', c2: 'hsl(220 48% 30%)', c3: 'hsl(278 38% 28%)' },
  rose: { c1: 'hsl(338 62% 38%)', c2: 'hsl(12 58% 38%)', c3: 'hsl(300 42% 32%)' },
  ocean: { c1: 'hsl(190 72% 32%)', c2: 'hsl(218 68% 38%)', c3: 'hsl(174 58% 30%)' },
  forest: { c1: 'hsl(144 52% 28%)', c2: 'hsl(164 50% 30%)', c3: 'hsl(93 48% 29%)' },
  amber: { c1: 'hsl(34 78% 36%)', c2: 'hsl(8 65% 36%)', c3: 'hsl(48 62% 32%)' },
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return [h, s, l]
}

// Samples the cover art and builds a tonal palette around its dominant vivid hue.
function extractColors(url: string): Promise<Palette> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => resolve(DEFAULT)
    img.onload = () => {
      try {
        const size = 24
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(DEFAULT)
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        const hues = Array.from({ length: 36 }, () => ({
          weight: 0,
          hueX: 0,
          hueY: 0,
          saturation: 0,
        }))
        let totalLightness = 0
        let pixelCount = 0
        for (let i = 0; i < data.length; i += 4) {
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
          totalLightness += l
          pixelCount += 1
          if (s < 0.12) continue
          const weight = s * (1 - Math.abs(l - 0.5) * 1.6)
          const bucket = hues[Math.floor(h / 10)]
          const radians = (h * Math.PI) / 180
          bucket.weight += weight
          bucket.hueX += Math.cos(radians) * weight
          bucket.hueY += Math.sin(radians) * weight
          bucket.saturation += s * weight
        }
        const dominant = hues.reduce((best, bucket) => bucket.weight > best.weight ? bucket : best)
        if (!dominant.weight) {
          const averageLightness = pixelCount ? totalLightness / pixelCount : 0.5
          const base = Math.round(16 + averageLightness * 20)
          resolve({
            c1: `hsl(0 0% ${base}%)`,
            c2: `hsl(0 0% ${Math.min(42, base + 6)}%)`,
            c3: `hsl(0 0% ${Math.max(10, base - 7)}%)`,
          })
          return
        }
        const h = (Math.atan2(dominant.hueY, dominant.hueX) * 180 / Math.PI + 360) % 360
        const sat = Math.round(Math.min(90, Math.max(55, dominant.saturation / dominant.weight * 110)))
        resolve({
          c1: `hsl(${Math.round(h)} ${sat}% 43%)`,
          c2: `hsl(${Math.round((h + 14) % 360)} ${sat}% 46%)`,
          c3: `hsl(${Math.round((h + 346) % 360)} ${Math.max(45, sat - 8)}% 35%)`,
        })
      } catch {
        resolve(DEFAULT)
      }
    }
    img.src = url
  })
}

export default function Background({ url, theme = 'album' }: { url?: string | null; theme?: PlayerTheme }) {
  const [layers, setLayers] = useState<Layer[]>([{ id: 0, colors: DEFAULT, artworkUrl: null }])
  const nextLayerId = useRef(1)

  useEffect(() => {
    let dead = false
    let removeTimer: ReturnType<typeof setTimeout> | undefined
    void (async () => {
      const colors = theme === 'album' ? (url ? await extractColors(url) : DEFAULT) : THEMES[theme]
      if (dead) return
      const id = nextLayerId.current++
      setLayers((l) => [...l.slice(-1), { id, colors, artworkUrl: theme === 'album' ? url ?? null : null }])
      removeTimer = setTimeout(() => setLayers((l) => l.filter((x) => x.id === id)), 1600)
    })()
    return () => {
      dead = true
      if (removeTimer) clearTimeout(removeTimer)
    }
  }, [url, theme])

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#08080c]" aria-hidden>
      {layers.map((l) => (
        <div
          key={l.id}
          className="bg-layer absolute inset-0"
          style={{ '--c1': l.colors.c1, '--c2': l.colors.c2, '--c3': l.colors.c3 } as CSSProperties}
        >
          {l.artworkUrl && (
            <div
              className="bg-artwork"
              style={{ backgroundImage: `url("${l.artworkUrl.replace(/["\\\n\r]/g, '')}")` }}
            />
          )}
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
        </div>
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(8,8,12,.7)_100%)]" />
      <div className="grain" />
    </div>
  )
}
