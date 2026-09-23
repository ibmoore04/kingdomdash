import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[10002] min-w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 p-1.5 shadow-2xl',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'


export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-body-small outline-none transition-all duration-150 ease-out data-[highlighted]:bg-primary-soft data-[highlighted]:text-text-primary focus-visible:bg-primary-soft focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-60 disabled:pointer-events-none disabled:transition-none motion-reduce:transition-none',
      className,
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'
