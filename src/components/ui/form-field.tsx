import { type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/cn'

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="ml-1 text-primary-hover" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> required</span> : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-caption text-text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
