import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { generateWhatsAppLink } from '@/utils/whatsapp'

interface WhatsAppCtaProps {
  message?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
}

export function WhatsAppCta({
  message = appConfig.whatsapp.defaultMessage,
  label = 'Chat on WhatsApp',
  variant = 'secondary',
}: WhatsAppCtaProps) {
  return (
    <Button asChild variant={variant} className={variant === 'primary' ? 'text-white bg-primary hover:bg-primary-hover font-bold' : ''}>
      <a href={generateWhatsAppLink(message)} target="_blank" rel="noreferrer" className={variant === 'primary' ? 'text-white' : ''}>
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {label}
      </a>
    </Button>
  )
}
