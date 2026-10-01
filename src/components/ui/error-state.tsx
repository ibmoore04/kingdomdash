import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  headingTag?: 'h1' | 'h2'
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again. If the problem continues, contact KingdomDash support.',
  onRetry,
  headingTag: Heading = 'h2',
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <AlertCircle className="mb-4 h-8 w-8 text-error" aria-hidden="true" />
      <Heading className="text-h4">{title}</Heading>
      <p className="mt-2 max-w-md text-body-small text-text-secondary">{description}</p>
      {onRetry ? (
        <Button className="mt-6" type="button" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
