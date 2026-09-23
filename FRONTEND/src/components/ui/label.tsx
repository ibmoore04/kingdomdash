import * as LabelPrimitive from '@radix-ui/react-label'
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-label text-text-primary', className)}
    {...props}
  />
))

Label.displayName = 'Label'
