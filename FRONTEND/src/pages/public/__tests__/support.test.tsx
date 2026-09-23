import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SupportPage from '../support'
import * as supportService from '@/services/supabase/support'

vi.mock('@/services/supabase/support', () => ({
  submitSupportTicket: vi.fn(),
}))

vi.mock('@/hooks/use-seo', () => ({
  useSeo: vi.fn(),
}))

const mockPushToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ pushToast: mockPushToast }),
}))

describe('SupportPage Component & Ticket Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders support page heading and verified contact channels', () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <SupportPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /We're Here to Help You Move/i })).toBeInTheDocument()
    expect(screen.getAllByText(/contact@kingdomdash\.net/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('+234 807 795 8755').length).toBeGreaterThan(0)
    expect(screen.getByText('Ijebu-Ode, Ogun State, Nigeria')).toBeInTheDocument()
    expect(screen.getByText('Live WhatsApp Dispatch')).toBeInTheDocument()
  })

  it('displays inactive account banner when reason=account_inactive is present', () => {
    render(
      <MemoryRouter initialEntries={['/support?reason=account_inactive']}>
        <SupportPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/Account Access Restricted:/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Account Re-activation Request')).toBeInTheDocument()
  })

  it('validates required fields before dispatching support request', async () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <SupportPage />
      </MemoryRouter>
    )

    const submitBtn = screen.getByRole('button', { name: /Dispatch Support Request/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Please provide your full name (minimum 2 characters).')).toBeInTheDocument()
      expect(screen.getByText('Please provide a valid email address.')).toBeInTheDocument()
    })

    expect(supportService.submitSupportTicket).not.toHaveBeenCalled()
  })

  it('submits valid form and displays confirmation with reference ticket ID', async () => {
    vi.mocked(supportService.submitSupportTicket).mockResolvedValueOnce({
      data: { success: true, ticket_id: 'TICKET-ABC-123' },
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/support']}>
        <SupportPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('e.g. Samuel Adeleke'), {
      target: { value: 'Babatunde Fashola' },
    })
    fireEvent.change(screen.getByPlaceholderText('you@domain.com'), {
      target: { value: 'babatunde@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Brief summary of request'), {
      target: { value: 'Inquiry regarding vendor onboarding' },
    })
    fireEvent.change(
      screen.getByPlaceholderText(
        'Please include relevant order codes, registered phone numbers, or account details...'
      ),
      {
        target: {
          value: 'I would like more information on setting up our restaurant on KingdomDash.',
        },
      }
    )

    const submitBtn = screen.getByRole('button', { name: /Dispatch Support Request/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(supportService.submitSupportTicket).toHaveBeenCalledWith({
        name: 'Babatunde Fashola',
        email: 'babatunde@example.com',
        phone: undefined,
        subject: '[GENERAL] Inquiry regarding vendor onboarding',
        message: 'I would like more information on setting up our restaurant on KingdomDash.',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Support Request Received')).toBeInTheDocument()
      expect(screen.getByText('TICKET-ABC-123')).toBeInTheDocument()
    })
  })
})
