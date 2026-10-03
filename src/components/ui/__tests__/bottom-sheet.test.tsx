import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomSheet } from '../bottom-sheet'

describe('BottomSheet component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Bottom Sheet',
    description: 'A helpful description',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('does not render when isOpen is false', () => {
    render(
      <BottomSheet {...defaultProps} isOpen={false}>
        <div>Sheet body content</div>
      </BottomSheet>
    )

    expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument()
    expect(screen.queryByText('Test Bottom Sheet')).not.toBeInTheDocument()
  })

  it('renders title, description, and children when isOpen is true', () => {
    render(
      <BottomSheet {...defaultProps}>
        <div>Sheet body content</div>
      </BottomSheet>
    )

    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument()
    expect(screen.getByText('Test Bottom Sheet')).toBeInTheDocument()
    expect(screen.getByText('A helpful description')).toBeInTheDocument()
    expect(screen.getByText('Sheet body content')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <BottomSheet {...defaultProps} onClose={handleClose}>
        <div>Content</div>
      </BottomSheet>
    )

    const closeBtn = screen.getByRole('button', { name: /close dialog/i })
    fireEvent.click(closeBtn)

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn()
    render(
      <BottomSheet {...defaultProps} onClose={handleClose}>
        <div>Content</div>
      </BottomSheet>
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the backdrop by default', () => {
    const handleClose = vi.fn()
    render(
      <BottomSheet {...defaultProps} onClose={handleClose}>
        <div>Content</div>
      </BottomSheet>
    )

    // The backdrop has aria-hidden="true"
    const backdrop = document.querySelector('.bg-black\\/60')
    expect(backdrop).toBeInTheDocument()
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(handleClose).toHaveBeenCalledTimes(1)
    }
  })

  it('does not call onClose when backdrop is clicked if closeOnBackdropClick is false', () => {
    const handleClose = vi.fn()
    render(
      <BottomSheet {...defaultProps} onClose={handleClose} closeOnBackdropClick={false}>
        <div>Content</div>
      </BottomSheet>
    )

    const backdrop = document.querySelector('.bg-black\\/60')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(handleClose).not.toHaveBeenCalled()
    }
  })

  it('locks body scroll while open and restores on unmount', () => {
    const { unmount } = render(
      <BottomSheet {...defaultProps}>
        <div>Content</div>
      </BottomSheet>
    )

    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('supports custom alertdialog role and custom footer', () => {
    render(
      <BottomSheet
        {...defaultProps}
        role="alertdialog"
        footer={<button type="button">Confirm Action</button>}
      >
        <div>Alert dialog message</div>
      </BottomSheet>
    )

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm action/i })).toBeInTheDocument()
  })
})
