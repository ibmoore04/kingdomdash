import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import { type ButtonHTMLAttributes, forwardRef, useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-button transition-colors transition-transform transition-shadow duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 disabled:grayscale-[0.3] disabled:translate-y-0 disabled:shadow-none disabled:transition-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0',
  {
    variants: {
      variant: {
        // Red primary buttons: solid red with white text; darker red with white text on hover
        primary:
          'bg-primary text-white hover:bg-primary-hover hover:text-white hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:scale-[1.02] active:bg-primary-active [&_*]:text-white',
        // White / neutral buttons: clean white with neutral border; subtle neutral hover
        secondary:
          'border border-border bg-white text-text-primary hover:bg-neutral-50 hover:text-text-primary hover:border-neutral-300 hover:shadow-xs active:bg-page-background',
        // Transparent / ghost: subtle neutral hover
        ghost: 'bg-transparent text-text-primary hover:bg-neutral-100 hover:text-text-primary hover:shadow-none',
        // Destructive (red) follows the same darker red with white text on hover
        destructive: 'bg-error text-white hover:bg-[#991b1b] hover:text-white hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] active:bg-[#991b1b] [&_*]:text-white',
        // Outline: clean neutral border with subtle neutral hover (never solid red!)
        outline:
          'border border-border bg-white text-text-primary hover:bg-neutral-50 hover:border-neutral-300 hover:text-text-primary hover:shadow-xs',
      },
      size: {
        sm: 'h-9 px-3 text-body-small',
        md: 'h-11 px-4',
        lg: 'h-12 px-6',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, style, ...props },
    ref,
  ) => {
    const [motionOk, setMotionOk] = useState(true)

    useEffect(() => {
      try {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        setMotionOk(!mq.matches)
        const handler = (e: MediaQueryListEvent) => setMotionOk(!e.matches)
        if (mq.addEventListener) mq.addEventListener('change', handler)
        else mq.addListener(handler)
        return () => {
          if (mq.removeEventListener) mq.removeEventListener('change', handler)
          else mq.removeListener(handler)
        }
      } catch {
        // If matchMedia not available, fall back to enabling motion
        setMotionOk(true)
      }
    }, [])

    const isInteractive = !disabled && !loading && motionOk
    const mergedStyle = {
      ...(isInteractive
        ? {
            transitionProperty: 'background-color, color, border-color, box-shadow, transform',
            transitionDuration: '200ms',
            transitionTimingFunction: 'cubic-bezier(0.25,0.46,0.45,0.94)',
          }
        : {}),
      ...style,
    }
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        style={mergedStyle}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {children}
          </>
        )}
      </Comp>
    )
  },
)

Button.displayName = 'Button'
