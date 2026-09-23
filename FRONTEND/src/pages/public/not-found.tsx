import { Link } from 'react-router-dom'
import { Section } from '@/components/layout/section'
import { useSeo } from '@/hooks/use-seo'

export default function NotFoundPage() {
  useSeo({ title: '404 — Page Not Found' })
  return (
    <Section tone="soft" spacing="loose">
      <div className="mx-auto max-w-lg text-center">
        <p
          className="text-[8rem] font-bold leading-none tracking-tighter text-border"
          aria-hidden="true"
        >
          404
        </p>
        <h1 className="mt-4 text-h1 font-bold text-text-primary">Page not found.</h1>
        <p className="mt-4 text-body-large text-text-secondary">
          The page you are looking for does not exist or may have been moved.
        </p>
        <Link
          to="/"
          className="btn-transition mt-8 inline-flex items-center gap-2 rounded-pill bg-primary px-8 py-3 text-button font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Back to Home
        </Link>
      </div>
    </Section>
  )
}
