import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeliveryPinCard } from '../delivery-pin-card'

describe('DeliveryPinCard Component (Phase 2)', () => {
  it('renders PIN formatted with digit spacing and security pass styling', () => {
    render(<DeliveryPinCard pin="842910" />)

    expect(screen.getByTestId('delivery-pin-card')).toBeInTheDocument()
    expect(screen.getByText('Security Pass')).toBeInTheDocument()
    expect(screen.getByText('Delivery Verification PIN')).toBeInTheDocument()

    const display = screen.getByTestId('delivery-pin-display')
    expect(display).toBeInTheDocument()
    expect(display.textContent).toBe('8  4  2  9  1  0')

    expect(screen.getByText(/Handover Protection/i)).toBeInTheDocument()
    expect(screen.getByText(/Never disclose this PIN over phone calls or WhatsApp/i)).toBeInTheDocument()
  })

  it('copies PIN to clipboard when Copy PIN button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(<DeliveryPinCard pin="1234" />)

    const copyBtn = screen.getByRole('button', { name: /Copy delivery verification PIN/i })
    expect(copyBtn).toBeInTheDocument()

    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('1234')
      expect(screen.getByText('Copied to clipboard')).toBeInTheDocument()
    })
  })
})
