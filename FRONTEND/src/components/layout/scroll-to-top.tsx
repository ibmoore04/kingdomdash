import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    // If navigating to a specific hash anchor (e.g. #contact-form or #details), scroll to that element
    if (hash) {
      // Delay slightly in case components or DOM elements are still mounting
      const timer = setTimeout(() => {
        const id = hash.replace('#', '')
        const element = document.getElementById(id) || document.querySelector(hash)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' })
          return
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      }, 100)
      return () => clearTimeout(timer)
    }

    // Default: Reset scroll to the absolute top of the page immediately
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) {
      document.documentElement.scrollTop = 0
    }
    if (document.body) {
      document.body.scrollTop = 0
    }

    // Also reset any active dashboard scrollable inner containers
    const scrollContainers = document.querySelectorAll('main.overflow-y-auto, div.overflow-y-auto')
    scrollContainers.forEach((el) => {
      // Avoid resetting modals or popups
      if (!el.closest('[role="dialog"]') && !el.closest('.fixed')) {
        el.scrollTop = 0
      }
    })
  }, [pathname, search, hash])

  return null
}
