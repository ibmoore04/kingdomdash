import { type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
}

export function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="flex items-start gap-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary-hover">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-caption uppercase tracking-wide text-text-muted">{label}</p>
        <p className="mt-1 text-h3">{value}</p>
      </div>
    </Card>
  )
}
