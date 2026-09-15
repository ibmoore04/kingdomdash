import { appConfig } from '@/config/app.config'

export function generateWhatsAppLink(message: string): string {
  const encodedMessage = encodeURIComponent(message)
  const cleanNumber = appConfig.whatsapp.businessNumber.replace(/[\s+]/g, '')
  return `https://wa.me/${cleanNumber}?text=${encodedMessage}`
}
