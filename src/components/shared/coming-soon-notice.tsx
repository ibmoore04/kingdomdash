import { Info } from 'lucide-react'
import { Alert } from '@/components/ui/alert'

export function ComingSoonNotice({
  title = 'This area is a UI placeholder',
  children = 'The visual shell is in place. Live data, authentication, payments, and maps will be connected in later phases.',
}: {
  title?: string
  children?: string
}) {
  return (
    <Alert variant="info" title={title}>
      {children}
    </Alert>
  )
}

export function ComingSoonNoticeWithIcon() {
  return (
    <div className="flex items-start gap-2 text-body-small text-text-secondary">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Feature not connected in Phase 1.</span>
    </div>
  )
}
