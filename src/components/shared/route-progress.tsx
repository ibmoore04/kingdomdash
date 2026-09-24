import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Preloader } from '@/components/shared/preloader'

interface RoutePreloaderProps {
  /** Minimum duration in milliseconds to display the preloader on page transitions. Default: 3000ms */
  minDurationMs?: number
}

/**
 * RoutePreloader — Full-screen sweet logo preloader displayed on every route transition
 * for at least 3 seconds before smoothly fading out.
 */
export function RoutePreloader({ minDurationMs = 3000 }: RoutePreloaderProps) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [fadingOut, setFadingOut] = useState(false)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Show preloader on initial load and on every location change
    setLoading(true)
    setFadingOut(false)

    // Schedule fade-out start shortly before unmounting to ensure a smooth 3-second exit
    const fadeOutDelay = Math.max(0, minDurationMs - 400)
    
    const fadeTimer = setTimeout(() => {
      setFadingOut(true)
    }, fadeOutDelay)

    const hideTimer = setTimeout(() => {
      setLoading(false)
      setFadingOut(false)
    }, minDurationMs)

    isFirstRender.current = false

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [location.pathname, location.search, minDurationMs])

  if (!loading) return null

  return (
    <div
      className={`fixed inset-0 z-[999999] pointer-events-none transition-opacity duration-500 ease-in-out ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <Preloader variant="floatingCircle" />
    </div>
  )
}

// Export RouteProgressBar alias for backward compatibility
export { RoutePreloader as RouteProgressBar }
