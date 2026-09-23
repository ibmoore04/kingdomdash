import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again. If the problem continues, contact KingdomDash support.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <AlertCircle className="mb-4 h-8 w-8 text-error" aria-hidden="true" />
      <h2 className="text-h4">{title}</h2>
      <p className="mt-2 max-w-md text-body-small text-text-secondary">{description}</p>
      {onRetry ? (
        <Button className="mt-6" type="button" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
