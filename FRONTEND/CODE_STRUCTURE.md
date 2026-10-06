# KingdomDash Codebase Architecture & Readability Guide

Welcome to the **KingdomDash** codebase! This document outlines the architecture, directory layout, core design patterns, and readability conventions implemented across the project.

---

## 🏛️ Directory Structure & Dual-Directory Parity

KingdomDash employs a dual directory structure where all application code in `src/` is mirrored with exact 1:1 parity in `FRONTEND/src/`:

```text
KindomDash/
├── src/ / FRONTEND/src/
│   ├── components/
│   │   ├── auth/              # Authentication modals, route guards, OTP inputs
│   │   ├── cart/              # Cart drawer, 1-tap meal upsells (Phase 4)
│   │   ├── checkout/          # Checkout steps, delivery location, campus landmarks
│   │   ├── common/            # PWA install banner, sound/haptic settings card
│   │   ├── customer/          # Dispute resolution, cancellation modals, timelines
│   │   ├── layout/            # Navbar, footer, section containers, mobile dock
│   │   ├── order/             # Live delivery map, PIN pass, receipts & invoices
│   │   ├── ui/                # Accessible design system primitives (Radix UI)
│   │   └── vendor/            # Kitchen display screen (KDS), menu managers
│   ├── constants/
│   │   └── campus-landmarks.ts# Authoritative TASUED campus GPS coordinates & landmarks
│   ├── pages/
│   │   ├── auth/              # Login, register, password recovery
│   │   ├── customer/          # Checkout, order confirmation & live tracking
│   │   ├── public/            # Food directory, groceries, courier, personal shopper
│   │   ├── rider/             # Dispatch cockpit, active route navigation
│   │   └── vendor/            # Orders incoming, live KDS, analytics, settings
│   ├── services/
│   │   ├── paystack/          # Authoritative payment initialization & webhook verification
│   │   └── supabase/          # Database client, RLS queries, orders, real-time sync
│   ├── stores/
│   │   ├── auth-store.ts      # User session, role verification, profile state
│   │   ├── cart-store.ts      # Item selection, modifiers, vendor collision guards
│   │   └── ui-store.ts        # Global toasts, modals, slide-overs, theme state
│   ├── types/                 # Shared TypeScript interfaces & Supabase generated models
│   └── utils/
│       ├── audio-chime.ts     # Synthesized Web Audio alert chimes & haptic vibration
│       ├── campus-discovery.ts# Student budget (Under ₦2,500) & late-night craving filters
│       ├── formatting.ts      # Currency (₦ NGN), date, distance formatting
│       ├── pwa-service-worker.ts # PWA install triggers, offline sync, desktop launcher
│       ├── receipt-generator.ts # Digital receipts, printable PDF invoices, WhatsApp dispatcher
│       └── settlement-export.ts # RFC 4180 CSV export for merchant bi-weekly settlements
├── BACKEND/supabase/
│   └── migrations/            # Authoritative SQL migrations, RLS policies, triggers
└── public/ / FRONTEND/public/
    ├── sw.js                  # Service Worker with Cache-First & Network-First strategies
    ├── manifest.json          # PWA web app manifest
    └── KingdomDash-emblem.png # Official high-resolution brand crest
```

---

## ⚡ The 5 Core Enhancement Engines

### 1. Sound & Haptics Engine (`src/utils/audio-chime.ts`)
- **Web Audio API Synthesis**: Generates clean musical chimes without requiring heavy audio assets or external network calls.
  - `playKitchenOrderChime()`: High two-tone (D5 587Hz → A5 880Hz) alert for kitchen tickets.
  - `playDispatchAlertChime()`: Energetic courier tone (G5 784Hz → C6 1046Hz) for dispatch assignments.
  - `playLockoutAlertBeep()`: Triple 220Hz alert for warnings or PIN lockouts.
- **Autoplay Gesture Unlock**: Pre-primes the hardware audio pipeline on touch/click events to work reliably on mobile Safari and Android Chrome.
- **Volume & Haptics Control**: Integrated with `SoundHapticsSettingsCard` and navbar quick mute.

### 2. PWA & Offline Resilience (`public/sw.js`, `src/utils/pwa-service-worker.ts`)
- **Universal Multi-Platform Installer**:
  - **Laptop / PC**: Automatically downloads a standalone desktop launcher (`KingdomDash-Desktop-App.html`) and provides 1-click address bar PWA install.
  - **Android**: Supports native Android install sheet and step-by-step Chrome menu guide.
  - **iPhone / iPad**: Guides Safari Share → Add to Home Screen.
- **Service Worker Caching**:
  - `CACHE_STATIC`: App shell, CSS, JavaScript, and brand assets.
  - `CACHE_DYNAMIC`: API responses with stale-while-revalidate fallback.
  - Offline mutation queue allowing cart actions to persist during temporary campus gate disconnections.

### 3. Live Interactive Courier Map (`src/components/order/delivery-live-map.tsx`)
- **Dynamic Haversine Calculation**: Calculates real-time distance in meters/km and estimated transit time (ETA).
- **Dual Visual Modes**: Allows switching between an animated radar view and an interactive OpenStreetMap street map with custom pins.
- **Landmark Courier Dock**: Generates pre-populated WhatsApp messages with gate landmark details (e.g., *"Waiting at TASUED Main Gate ATM Gallery"*).

### 4. Campus Smart Discovery & Budget Optimization (`src/utils/campus-discovery.ts`)
- **Pocket-Friendly Filter (`Under ₦2,500`)**: One-tap pill filter on the Food Directory isolating meals within student budgets.
- **Late-Night Cravings Mode**: Dynamically detects late hours (8:30 PM to 5:00 AM) and highlights verified late-night grills, suya, and shawarma spots.
- **Campus Landmarks (`src/constants/campus-landmarks.ts`)**: Pre-geocoded shortcuts for TASUED Main Gate, CEPEP Annex, Library Complex, and Ijagun Junction.
- **1-Tap Upsell Drawer (`src/components/cart/meal-pairing-upsell.tsx`)**: Quick-add chilled drinks, dodo, fried chicken, or table water directly in the cart.

### 5. Branded PDF Receipts & WhatsApp Invoice Dispatcher (`src/utils/receipt-generator.ts`)
- **Enterprise Digital Receipt**: Features official business credentials (`RC: 7892341 • TIN: 2489102-0001`), itemized breakdowns, delivery fees, and tips.
- **Print / PDF Generation**: Clean `@media print` styling for borderless paper receipt or PDF printing.
- **WhatsApp Dispatcher**: 1-tap WhatsApp sharing of clean formatted order summaries.
- **Settlement CSV Exporter (`src/utils/settlement-export.ts`)**: Generates RFC 4180 compliant CSV exports with UTF-8 BOM encoding for merchant payouts.

---

## 📐 Readability & Code Conventions

1. **Explicit TypeScript Interfaces**: Avoid loose `any` casts. Always import domain models from `@/types` or `@/types/database`.
2. **Predictable Component Sections**:
   ```tsx
   // ─── 1. Stores & Hooks ──────────────────────────────────────────────
   // ─── 2. Local Component State ───────────────────────────────────────
   // ─── 3. Event Handlers & Callbacks ──────────────────────────────────
   // ─── 4. JSX Render ──────────────────────────────────────────────────
   ```
3. **Safe Storage Access**: All `localStorage` interactions must be guarded with `typeof window !== 'undefined'` and wrapped in `try/catch` blocks for private browsing mode safety.
4. **Authoritative Backend Ledger**: Financial balances, order status changes, and PIN verification are executed server-side via Supabase Edge Functions and PostgreSQL RPC functions, never computed unsafely in client state.

---

## 🛠️ Developer Cheatsheet

```bash
# Run local development server (Vite on http://localhost:5173)
npm run dev

# Run Vitest automated test suite (44+ tests)
npm run test

# Validate TypeScript types without emit
npx tsc --noEmit

# Run fast code linting via oxlint
npm run lint
```
