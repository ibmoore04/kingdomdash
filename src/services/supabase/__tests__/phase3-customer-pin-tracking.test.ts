import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Phase 3: Customer Live Tracking PIN Reveal Card & Verification UX', () => {
  const srcPinCardPath = path.resolve(
    __dirname,
    '../../../components/order/delivery-pin-card.tsx'
  )
  const frontendPinCardPath = path.resolve(
    __dirname,
    '../../../../FRONTEND/src/components/order/delivery-pin-card.tsx'
  )

  const srcStepperPath = path.resolve(
    __dirname,
    '../../../components/order/live-delivery-stepper.tsx'
  )
  const frontendStepperPath = path.resolve(
    __dirname,
    '../../../../FRONTEND/src/components/order/live-delivery-stepper.tsx'
  )

  it('verifies 1:1 dual directory parity for DeliveryPinCard', () => {
    expect(fs.existsSync(srcPinCardPath)).toBe(true)
    expect(fs.existsSync(frontendPinCardPath)).toBe(true)

    const srcCode = fs.readFileSync(srcPinCardPath, 'utf8')
    const frontendCode = fs.readFileSync(frontendPinCardPath, 'utf8')
    expect(srcCode).toBe(frontendCode)
  })

  it('verifies 1:1 dual directory parity for LiveDeliveryStepper', () => {
    expect(fs.existsSync(srcStepperPath)).toBe(true)
    expect(fs.existsSync(frontendStepperPath)).toBe(true)

    const srcCode = fs.readFileSync(srcStepperPath, 'utf8')
    const frontendCode = fs.readFileSync(frontendStepperPath, 'utf8')
    expect(srcCode).toBe(frontendCode)
  })

  it('verifies DeliveryPinCard features masked state, eye toggle and security advisory', () => {
    const code = fs.readFileSync(srcPinCardPath, 'utf8')

    // Masked default state
    expect(code).toContain('const [isMasked, setIsMasked] = useState(true)')
    expect(code).toContain("pin.split('').map(() => '•').join('  ')")

    // Eye toggle button & icons
    expect(code).toContain('Eye')
    expect(code).toContain('EyeOff')
    expect(code).toContain('Reveal PIN digits')
    expect(code).toContain('Hide PIN digits')

    // Clipboard copy
    expect(code).toContain('navigator.clipboard.writeText(pin)')
    expect(code).toContain('Copy PIN')
    expect(code).toContain('Copied to clipboard')

    // Security advisory
    expect(code).toContain('Only share this PIN with your rider in person')
    expect(code).toContain('Never share it over phone calls or WhatsApp')
  })

  it('verifies LiveDeliveryStepper supports multi-stage custody transitions', () => {
    const code = fs.readFileSync(srcStepperPath, 'utf8')

    expect(code).toContain("'payment_confirmed'")
    expect(code).toContain("'preparing'")
    expect(code).toContain("'ready_for_pickup'")
    expect(code).toContain("'in_transit'")
    expect(code).toContain("'delivered'")
    expect(code).toContain('progressPercent')
  })
})
