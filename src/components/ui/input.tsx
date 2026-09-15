import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-md border border-border bg-white px-3 text-body text-text-primary placeholder:text-text-muted transition-all duration-200 ease-out focus:border-primary focus:shadow-[0_0_0_2px_rgba(170,59,255,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:bg-light-surface disabled:text-text-muted disabled:opacity-60 disabled:transition-none motion-reduce:transition-none',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)

Input.displayName = 'Input'
