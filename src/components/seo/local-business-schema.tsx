import { appConfig } from '@/config/app.config'

export function getLocalBusinessSchema(serviceType: 'food' | 'grocery' | 'courier' | 'general' = 'general') {
  const serviceNames = {
    food: 'Food Delivery in Ijebu-Ode',
    grocery: 'Grocery Delivery in Ijebu-Ode',
    courier: 'Same-Day Courier & Parcel Dispatch in Ijebu-Ode',
    general: 'On-Demand Multi-Service Delivery Platform in Ijebu-Ode',
  }

  const descriptions = {
    food: 'Order hot, freshly cooked meals from top verified restaurants and kitchens in Ijebu-Ode with swift 30–45 minute doorstep delivery.',
    grocery: 'Shop fresh market foodstuffs, pantry staples, and supermarket items with doorstep delivery across Ijebu-Ode, Ogun State.',
    courier: 'Fast, secure parcel pickup and dispatch across Ijebu-Ode with real-time GPS tracking and fair distance-based pricing.',
    general: 'KingdomDash is the premier multi-service delivery platform serving Ijebu-Ode, Ogun State. Food, groceries, and fast courier logistics.',
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'DeliveryService',
    name: `KingdomDash — ${serviceNames[serviceType]}`,
    description: descriptions[serviceType],
    url: appConfig.url,
    telephone: appConfig.support.phoneRaw,
    email: appConfig.support.email,
    provider: {
      '@type': 'Organization',
      name: 'KingdomDash',
      slogan: appConfig.tagline,
      url: appConfig.url,
      logo: `${appConfig.url}/logo.png`,
      sameAs: [
        appConfig.socials.instagram.url,
        appConfig.socials.tiktok.url,
        appConfig.socials.whatsapp.url,
      ],
    },
    areaServed: {
      '@type': 'AdministrativeArea',
      name: 'Ijebu-Ode, Ogun State, Nigeria',
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 6.8227,
        longitude: 3.9209,
      },
    },
    priceRange: '₦₦',
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '08:00',
      closes: '22:00',
    },
  }
}
