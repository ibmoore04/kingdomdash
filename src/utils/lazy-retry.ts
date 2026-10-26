import { type ComponentType, lazy } from 'react'

/**
 * Wraps dynamic React.lazy imports with auto-recovery for stale chunks.
 * When a new deployment occurs on Vercel, previous JS chunks are deleted from edge nodes.
 * If an active user navigates to an unvisited route, the browser throws:
 * "Failed to fetch dynamically imported module" or MIME type "text/html" mismatch.
 * This utility catches the error and forces a clean window.location.reload() so the user
 * seamlessly loads the latest version instead of getting stuck on an error screen.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await componentImport()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const isChunkError =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('MIME type') ||
        message.includes('Loading chunk') ||
        message.includes('Importing a module script failed') ||
        message.includes('error loading dynamically imported module')

      if (isChunkError && typeof window !== 'undefined') {
        const key = 'kd_reload_chunk_' + window.location.pathname
        const lastReload = Number(sessionStorage.getItem(key) || 0)
        const now = Date.now()

        // Only reload if we haven't reloaded this path in the last 10 seconds (avoids infinite loops)
        if (now - lastReload > 10000) {
          sessionStorage.setItem(key, String(now))
          console.warn('[KingdomDash] Stale deployment chunk detected. Reloading page for new release...')
          window.location.reload()
          // Return a hanging promise while the page reloads
          return new Promise<{ default: T }>(() => {})
        }
      }

      throw error
    }
  })
}
