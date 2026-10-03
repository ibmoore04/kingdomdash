import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VendorConflictModal } from '../vendor-conflict-modal'

describe('VendorConflictModal component', () => {
  const defaultProps = {
    isOpen: true,
    currentVendorName: 'Mama Put Kitchen',
    newVendorName: 'Chicken Republic',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    render(<VendorConflictModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByTestId('vendor-conflict-modal')).not.toBeInTheDocument()
  })

  it('renders title, vendor names, and buttons when open', () => {
    render(<VendorConflictModal {...defaultProps} />)

    expect(screen.getByTestId('vendor-conflict-modal')).toBeInTheDocument()
    expect(screen.getByText('Start a new cart?')).toBeInTheDocument()
    expect(screen.getByText('Mama Put Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Chicken Republic')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /keep existing cart/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start new cart/i })).toBeInTheDocument()
  })

  it('calls onConfirm when Start New Cart is clicked', () => {
    const handleConfirm = vi.fn()
    render(<VendorConflictModal {...defaultProps} onConfirm={handleConfirm} />)

    fireEvent.click(screen.getByRole('button', { name: /start new cart/i }))
    expect(handleConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Keep Existing Cart is clicked', () => {
    const handleCancel = vi.fn()
    render(<VendorConflictModal {...defaultProps} onCancel={handleCancel} />)

    fireEvent.click(screen.getByRole('button', { name: /keep existing cart/i }))
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })
})
