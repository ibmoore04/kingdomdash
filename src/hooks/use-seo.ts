import { useEffect } from 'react'

interface SeoOptions {
  title?: string
  description?: string
}

export function useSeo({ title, description }: SeoOptions = {}) {
  useEffect(() => {
    const previousTitle = document.title
    const baseTitle = 'KingdomDash — SWIFT IN MOTION.'
    document.title = title ? `${title} | ${baseTitle}` : baseTitle

    let metaDesc = document.querySelector('meta[name="description"]')
    const previousDesc = metaDesc ? metaDesc.getAttribute('content') : null

    if (description) {
      if (!metaDesc) {
        metaDesc = document.createElement('meta')
        metaDesc.setAttribute('name', 'description')
        document.head.appendChild(metaDesc)
      }
      metaDesc.setAttribute('content', description)
    }

    return () => {
      document.title = previousTitle
      if (previousDesc !== null && metaDesc) {
        metaDesc.setAttribute('content', previousDesc)
      }
    }
  }, [title, description])
}
