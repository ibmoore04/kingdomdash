import { useEffect } from 'react'

interface SeoOptions {
  title?: string
  description?: string
  keywords?: string
  schema?: Record<string, unknown>
}

export function useSeo({ title, description, keywords, schema }: SeoOptions = {}) {
  useEffect(() => {
    const previousTitle = document.title
    const baseTitle = 'KingdomDash — SWIFT IN MOTION.'
    document.title = title ? `${title} | ${baseTitle}` : baseTitle

    // Meta Description
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

    // Meta Keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]')
    if (keywords) {
      if (!metaKeywords) {
        metaKeywords = document.createElement('meta')
        metaKeywords.setAttribute('name', 'keywords')
        document.head.appendChild(metaKeywords)
      }
      metaKeywords.setAttribute('content', keywords)
    }

    // JSON-LD Schema
    let scriptSchema: HTMLScriptElement | null = null
    if (schema) {
      scriptSchema = document.createElement('script')
      scriptSchema.setAttribute('type', 'application/ld+json')
      scriptSchema.textContent = JSON.stringify(schema)
      document.head.appendChild(scriptSchema)
    }

    return () => {
      document.title = previousTitle
      if (previousDesc !== null && metaDesc) {
        metaDesc.setAttribute('content', previousDesc)
      }
      if (scriptSchema && document.head.contains(scriptSchema)) {
        document.head.removeChild(scriptSchema)
      }
    }
  }, [title, description, keywords, schema])
}

