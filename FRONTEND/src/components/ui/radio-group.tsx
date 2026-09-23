import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Circle } from 'lucide-react'
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export const RadioGroup = RadioGroupPrimitive.Root

export const RadioGroupItem = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white transition-all duration-200 ease-out data-[state=checked]:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:transition-none motion-reduce:transition-none',
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
))

RadioGroupItem.displayName = 'RadioGroupItem'
