import { formatPhoneDisplay } from '@/utils/phone'

const rawOfficialPhone =
  import.meta.env.VITE_OFFICIAL_PHONE_NUMBER ||
  import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER ||
  '+2348077958755'

export const appConfig = {
  name: import.meta.env.VITE_APP_NAME || 'KingdomDash',
  tagline: 'SWIFT IN MOTION.',
  url: import.meta.env.VITE_APP_URL || 'https://kingdomdash.com',
  launchMarket: 'Ijebu-Ode, Ogun State',
  expansionMarkets: 'Ogun State and subsequent markets',
  support: {
    email: 'Contact@kingdomdash.net',
    phoneRaw: rawOfficialPhone,
    phoneDisplay: formatPhoneDisplay(rawOfficialPhone) || '+234 807 795 8755',
    hours: 'Monday–Sunday, 8:00 AM – 10:00 PM WAT',
    address: 'Ijebu-Ode, Ogun State, Nigeria',
  },
  whatsapp: {
    businessNumber: import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER || '+2348077958755',
    defaultMessage: 'Hello KingdomDash, I would like to place an order.',
  },
} as const
