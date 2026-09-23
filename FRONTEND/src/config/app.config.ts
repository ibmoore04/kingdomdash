import { formatPhoneDisplay } from '@/utils/phone'

const rawOfficialPhone =
  import.meta.env.VITE_OFFICIAL_PHONE_NUMBER ||
  '+2349070509251'

const rawWhatsAppNumber =
  import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER ||
  '+2348077958755'

export const appConfig = {
  name: import.meta.env.VITE_APP_NAME || 'KingdomDash',
  tagline: 'SWIFT IN MOTION.',
  philosophy: 'Powered by Excellence. Guided by Grace.',
  url: import.meta.env.VITE_APP_URL || 'https://kingdomdash.net',
  launchMarket: 'Ijebu-Ode, Ogun State',
  expansionMarkets: 'Ogun State and subsequent markets',
  support: {
    email: 'contact@kingdomdash.net',
    phoneRaw: rawOfficialPhone,
    phoneDisplay: formatPhoneDisplay(rawOfficialPhone) || '+234 907 050 9251',
    hours: 'Monday–Sunday, 8:00 AM – 10:00 PM WAT',
    address: 'Ijebu-Ode, Ogun State, Nigeria',
  },
  whatsapp: {
    businessNumber: rawWhatsAppNumber,
    phoneDisplay: formatPhoneDisplay(rawWhatsAppNumber) || '+234 807 795 8755',
    defaultMessage: 'Hello KingdomDash, I would like to place an order.',
  },
  socials: {
    instagram: {
      handle: 'king_domdash',
      url: 'https://instagram.com/king_domdash',
    },
    tiktok: {
      handle: 'Kingdomdash0',
      url: 'https://www.tiktok.com/@Kingdomdash0',
    },
    whatsapp: {
      number: rawWhatsAppNumber,
      url: `https://wa.me/${rawWhatsAppNumber.replace(/[^0-9]/g, '')}`,
    },
  },
} as const
