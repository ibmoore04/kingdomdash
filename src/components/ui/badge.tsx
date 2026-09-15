import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const variants = {
  default: 'bg-light-surface text-text-secondary border-border',
  primary: 'bg-primary-soft text-primary-hover border-primary/20',
  success: 'bg-[#dcfce7] text-[#166534] border-[#86efac]',
  warning: 'bg-[#fef3c7] text-[#92400e] border-[#fcd34d]',
  error: 'bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]',
  info: 'bg-[#dbeafe] text-[#1e40af] border-[#93c5fd]',
  dark: 'bg-near-black text-white border-dark-surface',
} as const

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill border px-2.5 py-0.5 text-caption font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
