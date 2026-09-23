import { Phone, MessageSquare } from 'lucide-react'
import { appConfig } from '@/config/app.config'

export function CheckoutHelpCard() {
  const displayPhone = '0812 345 6789'
  const telHref = 'tel:08123456789'
  const whatsappUrl = `https://wa.me/${appConfig.whatsapp.businessNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
    'Hello KingdomDash Support, I have a question about my order checkout.'
  )}`

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="mb-3.5">
        <h3 className="text-base font-bold text-neutral-900">
          Need help?
        </h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Our support team is here for you
        </p>
      </div>

      <div className="space-y-2.5">
        {/* Phone Contact */}
        <a
          href={telHref}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-xs font-semibold text-neutral-800 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <span>{displayPhone}</span>
        </a>

        {/* Live Chat */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-xs font-semibold text-neutral-800 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <span>Live Chat</span>
        </a>
      </div>
    </div>
  )
}
