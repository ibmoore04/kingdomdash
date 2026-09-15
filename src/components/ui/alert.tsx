import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const styles = {
  info: 'border-info/30 bg-[#eff6ff] text-[#1e3a8a]',
  success: 'border-success/30 bg-[#f0fdf4] text-[#166534]',
  warning: 'border-warning/30 bg-[#fffbeb] text-[#92400e]',
  error: 'border-error/30 bg-[#fef2f2] text-[#991b1b]',
} as const

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
}

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof styles
  title: string
  children?: ReactNode
}

export function Alert({ variant = 'info', title, children, className, ...props }: AlertProps) {
  const Icon = icons[variant]
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-md border p-4', styles[variant], className)}
      {...props}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-label">{title}</p>
        {children ? <div className="mt-1 text-body-small">{children}</div> : null}
      </div>
    </div>
  )
}
