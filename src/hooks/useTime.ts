import { useEffect, useState } from 'react'

// Re-renders the calling component every animation frame with the current playback position (ms).
export function useTime(getPosition: () => number): number {
  const [time, setTime] = useState<number>(() => getPosition())
  useEffect(() => {
    let raf = 0
    const tick = () => {
      setTime(getPosition())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getPosition])
  return time
}
