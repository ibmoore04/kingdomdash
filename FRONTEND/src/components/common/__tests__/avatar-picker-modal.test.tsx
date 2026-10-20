import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AvatarPickerModal } from '../avatar-picker-modal'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/services/supabase/client'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-test-1', email: 'test@kingdomdash.com' } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn(),
  },
}))

describe('AvatarPickerModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      profile: {
        id: 'user-test-1',
        email: 'test@kingdomdash.com',
        full_name: 'Test Customer',
        phone: null,
        avatar_url: null,
        role: 'customer',
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    })
  })

  it('renders modal dialog when open is true', () => {
    render(<AvatarPickerModal open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /choose kingdomdash character/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3d dolls/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /anime/i })).toBeInTheDocument()
  })

  it('filters character cards when clicking filter buttons', () => {
    render(<AvatarPickerModal open={true} onOpenChange={vi.fn()} />)

    const dollsFilterBtn = screen.getByRole('button', { name: /3d dolls/i })
    fireEvent.click(dollsFilterBtn)

    // Prince Malik and Princess Tiara should be visible
    expect(screen.getByText('Prince Malik')).toBeInTheDocument()
    expect(screen.getByText('Princess Tiara')).toBeInTheDocument()
  })

  it('saves chosen avatar to Supabase and updates store on equip', async () => {
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    ;(supabase.from as any).mockReturnValue({
      update: updateSpy,
    })

    const onOpenChange = vi.fn()
    const onAvatarSaved = vi.fn()

    render(
      <AvatarPickerModal
        open={true}
        onOpenChange={onOpenChange}
        onAvatarSaved={onAvatarSaved}
      />
    )

    // Click on a character card
    const princeCard = screen.getByText('Prince Malik')
    fireEvent.click(princeCard)

    // Click Equip button
    const equipBtn = screen.getByRole('button', { name: /equip prince malik/i })
    fireEvent.click(equipBtn)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        avatar_url: '/avatars/characters/royal-doll-prince.jpg',
      })
    })

    expect(useAuthStore.getState().profile?.avatar_url).toBe(
      '/avatars/characters/royal-doll-prince.jpg'
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onAvatarSaved).toHaveBeenCalledWith('/avatars/characters/royal-doll-prince.jpg')
  })
})
