import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Preloader } from '@/components/shared/preloader'

interface RoutePreloaderProps {
  /** Minimum duration in milliseconds to display the initial splash preloader. Default: 2500ms */
  minDurationMs?: number
  /** Whether the full-screen preloader only shows on initial app load, not on every routing. Default: true */
  initialOnly?: boolean
}

/**
 * RoutePreloader (RouteProgressBar)
 * - Initial load: Branded full-screen logo preloader while the app initializes.
 * - Route transitions: Sleek, non-blocking top progress bar (YouTube/GitHub style).
 *   Never shows a blocking full-screen overlay for routine page routing.
 */
export function RoutePreloader({ minDurationMs = 2500, initialOnly = true }: RoutePreloaderProps) {
  const location = useLocation()
  const isInitialMount = useRef(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [fadingOut, setFadingOut] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [navProgress, setNavProgress] = useState(0)

  // 1. Initial cold-start preloader — only runs on initial application mount
  useEffect(() => {
    const fadeOutDelay = Math.max(0, minDurationMs - 400)
    
    const fadeTimer = setTimeout(() => {
      setFadingOut(true)
    }, fadeOutDelay)

    const hideTimer = setTimeout(() => {
      setInitialLoading(false)
      setFadingOut(false)
      isInitialMount.current = false
    }, minDurationMs)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [minDurationMs])

  // 2. Route transitions — sleek top progress indicator, never blocking full-screen
  useEffect(() => {
    // Skip if still on initial mount
    if (isInitialMount.current) return

    if (!initialOnly) {
      setInitialLoading(true)
      return
    }

    setNavigating(true)
    setNavProgress(25)

    const step1 = setTimeout(() => setNavProgress(70), 80)
    const step2 = setTimeout(() => setNavProgress(100), 200)
    const cleanup = setTimeout(() => {
      setNavigating(false)
      setNavProgress(0)
    }, 350)

    return () => {
      clearTimeout(step1)
      clearTimeout(step2)
      clearTimeout(cleanup)
    }
  }, [location.pathname, location.search])

  return (
    <>
      {/* Initial load full-screen branded preloader (only once per app session / hard refresh) */}
      {initialLoading && (
        <div
          className={`fixed inset-0 z-[999999] pointer-events-none transition-opacity duration-500 ease-in-out ${
            fadingOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <Preloader variant="floatingCircle" />
        </div>
      )}

      {/* Modern top route progress bar for smooth navigation */}
      {navigating && (
        <div
          role="progressbar"
          aria-label="Page loading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={navProgress}
          className="fixed top-0 left-0 right-0 z-[999999] h-[3px] pointer-events-none bg-transparent"
        >
          <div
            className="h-full bg-primary shadow-[0_0_10px_rgba(229,9,20,0.8)] transition-all duration-200 ease-out"
            style={{ width: `${navProgress}%` }}
          />
        </div>
      )}
    </>
  )
}

// Export RouteProgressBar alias for backward compatibility
export { RoutePreloader as RouteProgressBar }

