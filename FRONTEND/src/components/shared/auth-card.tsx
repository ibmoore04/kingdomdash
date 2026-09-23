import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-white/12 bg-[rgba(10,10,10,0.45)] shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-md flex'
        )}
      >
        {/* Left logo column - collapsed on small screens */}
        <aside className="hidden sm:flex sm:w-36 lg:w-40 flex-col items-center gap-6 border-r border-white/6 bg-gradient-to-b from-black/60 via-black/50 to-black/60 py-6 px-3">
          <div className="flex flex-col items-center gap-4">
            <img src="/KingdomDash-logo.jpg" alt="logo" className="h-10 w-auto rounded-sm shadow-sm" />
            <div className="space-y-2">
              <img src="/KingdomDash-logo.jpg" alt="logo" className="h-6 w-auto opacity-80" />
              <img src="/KingdomDash-logo.jpg" alt="logo" className="h-5 w-auto opacity-60" />
            </div>
          </div>
        </aside>

        {/* Right content */}
        <div className="flex-1 p-8">
          <div className="relative z-10">
            <h2 className="text-display font-bold text-white">{title}</h2>
            {subtitle ? <p className="mt-2 text-body-small text-white/85">{subtitle}</p> : null}

            <div className="mt-6">{children}</div>

            {footer ? <div className="mt-4">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AuthInput({ label, className, ...props }: { label?: string; className?: string } &
  React.ComponentPropsWithoutRef<typeof Input>) {
  return (
    <label className="flex w-full flex-col gap-2">
      {label ? <span className="text-body-small text-white/70">{label}</span> : null}
      <Input {...props} className={cn('auth-input', className)} />
    </label>
  )
}

export default AuthCard
