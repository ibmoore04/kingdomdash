import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Section, PageContainer } from '@/components/layout/section'
import { SectionHeading } from '@/components/shared/section-heading'
import { cn } from '@/lib/cn'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'

interface FaqItem {
  id: string
  question: string
  answer: string
}

interface FaqCategory {
  id: string
  label: string
  items: FaqItem[]
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'food',
    label: 'Food Delivery',
    items: [
      {
        id: 'food-1',
        question: 'How long does food delivery take?',
        answer:
          'Most food orders are delivered within 30–45 minutes of confirmation, depending on your location and the restaurant\'s preparation time. During peak hours, delivery can take up to 60 minutes. You will receive real-time updates as your order progresses.',
      },
      {
        id: 'food-2',
        question: 'Can I track my food order in real time?',
        answer:
          'Yes. Once a rider picks up your order, you can follow the delivery progress directly within the app. You will receive status notifications at each stage: order confirmed, being prepared, picked up, and out for delivery.',
      },
      {
        id: 'food-3',
        question: 'What restaurants are available on KingdomDash?',
        answer:
          `KingdomDash partners with a growing selection of local restaurants, bukas, and food vendors launching in ${appConfig.launchMarket}. Browse the Food Delivery section or reach our operations desk to see current offerings.`,
      },
      {
        id: 'food-4',
        question: 'Is there a minimum order amount for food delivery?',
        answer:
          'Minimum order amounts vary by restaurant. Each vendor sets their own threshold, which is displayed on their menu page before you place an order. There is no platform-wide minimum imposed by KingdomDash.',
      },
    ],
  },
  {
    id: 'grocery',
    label: 'Grocery Delivery',
    items: [
      {
        id: 'grocery-1',
        question: 'Which grocery stores are available?',
        answer:
          'KingdomDash works with trusted neighbourhood grocery stores and supermarkets in your area. The stores available to you are shown when you open the Groceries section. We continue to onboard new store partners regularly.',
      },
      {
        id: 'grocery-2',
        question: 'How fresh are the grocery items?',
        answer:
          'We partner only with stores that maintain proper storage and handling standards. Perishable items like fruits, vegetables, and dairy are sourced daily. If you ever receive an item that does not meet your expectations, our support team will make it right.',
      },
      {
        id: 'grocery-3',
        question: 'Can I schedule a grocery delivery in advance?',
        answer:
          'Scheduled delivery is a feature we are actively developing. At this time, grocery orders are fulfilled on demand. You will be notified when advance scheduling becomes available in your area.',
      },
      {
        id: 'grocery-4',
        question: 'Are substitutions made when an item is out of stock?',
        answer:
          'If an item is unavailable, the rider or store will contact you before substituting it. You can approve or decline any substitution. You will only be charged for items you actually receive.',
      },
    ],
  },
  {
    id: 'courier',
    label: 'Courier',
    items: [
      {
        id: 'courier-1',
        question: 'What items can I send via KingdomDash Courier?',
        answer:
          'You can send documents, parcels, clothing, electronics, and most everyday goods. We do not accept hazardous materials, liquids over 1 litre without sealed packaging, or prohibited items under Nigerian law. Contact support if you are unsure about a specific item.',
      },
      {
        id: 'courier-2',
        question: 'How is the delivery fee calculated for courier orders?',
        answer:
          'Courier fees are calculated based on the distance between pickup and drop-off locations, plus the weight and dimensions of your package. A fee estimate is shown before you confirm the booking so there are no surprises.',
      },
      {
        id: 'courier-3',
        question: 'Is there a weight or size limit for packages?',
        answer:
          'Standard courier orders accommodate packages up to 10 kg and dimensions that fit comfortably on a motorcycle. For heavier or bulkier items, please contact our support team to arrange a suitable vehicle.',
      },
      {
        id: 'courier-4',
        question: 'Can I send a package to multiple recipients in one order?',
        answer:
          'Multi-stop courier orders are not yet supported in the app. Each delivery is currently point-to-point. We recommend placing separate courier orders for different recipients. Multi-stop dispatching is on our roadmap.',
      },
    ],
  },
  {
    id: 'support',
    label: 'General / Support',
    items: [
      {
        id: 'support-1',
        question: 'How do I contact KingdomDash support?',
        answer:
          'You can reach our support team via WhatsApp, the in-app chat, or by visiting our Contact page. Our team is available seven days a week. For urgent delivery issues, WhatsApp is the fastest channel.',
      },
      {
        id: 'support-2',
        question: 'What payment methods are accepted?',
        answer:
          'KingdomDash currently accepts bank transfers and card payments. Cash on delivery is available in select areas. Additional payment methods will be added as the platform grows.',
      },
      {
        id: 'support-3',
        question: 'How do I report a problem with my order?',
        answer:
          'Go to your order history in the app and select the relevant order, then tap "Report an Issue." You can also contact support directly via WhatsApp or the Contact page. Please report problems within 24 hours of delivery for the fastest resolution.',
      },
      {
        id: 'support-4',
        question: 'Can I cancel or modify an order after placing it?',
        answer:
          'You can cancel an order before a rider accepts it at no charge. Once a rider is assigned, cancellation may incur a small fee. Modifications after placement are not supported — you would need to cancel and reorder. Contact support promptly if you need help.',
      },
    ],
  },
]

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-border last:border-0">
      <h3>
        <button
          id={`${item.id}-question`}
          type="button"
          aria-expanded={isOpen}
          aria-controls={`${item.id}-answer`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 py-4 text-left text-body font-medium text-text-primary transition-all duration-200 ease-out hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span>{item.question}</span>
          <ChevronDown
            className={cn(
              'h-5 w-5 shrink-0 text-text-secondary transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </h3>
      {isOpen && (
        <div
          id={`${item.id}-answer`}
          role="region"
          aria-labelledby={`${item.id}-question`}
          className="pb-4 text-body text-text-secondary"
        >
          {item.answer}
        </div>
      )}
    </div>
  )
}

export default function FaqPage() {
  useSeo({
    title: 'FAQ & Help Centre',
    description: `Frequently asked questions about food delivery, grocery orders, and courier dispatch with KingdomDash in ${appConfig.launchMarket}. Swift in Motion.`,
  })

  const [openId, setOpenId] = useState<string | null>(null)

  function handleToggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <>
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────── */}
      <section data-navbar-theme="dark" className="bg-near-black py-20 sm:py-28">
        <PageContainer>
          <p className="mb-4 text-eyebrow font-semibold uppercase tracking-[0.22em] text-primary">
            Help Centre
          </p>
          <h1 className="max-w-2xl text-display-xl font-bold leading-[0.97] tracking-tight text-white">
            Frequently asked questions.
          </h1>
          <p className="mt-5 max-w-xl text-body-large text-white/60">
            Find answers to the most common questions about KingdomDash.
          </p>
        </PageContainer>
      </section>

      {/* FAQ Sections */}
      {FAQ_CATEGORIES.map((category, index) => (
        <Section
          key={category.id}
          id={`faq-${category.id}`}
          tone={index % 2 === 0 ? 'soft' : 'light'}
        >
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              eyebrow="FAQ"
              title={category.label}
            />
      <div className="mt-8 rounded-xl border border-border bg-white px-6 shadow-card">
              {category.items.map((item) => (
                <FaqAccordionItem
                  key={item.id}
                  item={item}
                  isOpen={openId === item.id}
                  onToggle={() => handleToggle(item.id)}
                />
              ))}
            </div>
          </div>
        </Section>
      ))}
    </>
  )
}
