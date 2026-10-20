import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KingdomAvatar } from '../kingdom-avatar'

describe('KingdomAvatar Component', () => {
  it('renders with an explicit avatarUrl', () => {
    render(
      <KingdomAvatar
        avatarUrl="/avatars/characters/royal-doll-prince.jpg"
        name="Prince Malik"
        alt="Prince Malik Avatar"
      />
    )

    const img = screen.getByRole('img', { name: /prince malik avatar/i }) as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toContain('/avatars/characters/royal-doll-prince.jpg')
  })

  it('falls back to deterministic generated character when avatarUrl is null', () => {
    render(
      <KingdomAvatar
        userId="user-12345"
        name="John Doe"
      />
    )

    const img = screen.getByRole('img') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toMatch(/\/avatars\/characters\/.+/)
  })

  it('renders badge when showBadge is true', () => {
    const { container } = render(
      <KingdomAvatar
        userId="user-12345"
        showBadge={true}
      />
    )

    const badge = container.querySelector('span[title]')
    expect(badge).toBeInTheDocument()
  })

  it('handles image error and falls back gracefully', () => {
    render(
      <KingdomAvatar
        userId="user-test-fallback"
        avatarUrl="/broken-image-link.jpg"
      />
    )

    const img = screen.getByRole('img') as HTMLImageElement
    // Simulate image error
    fireEvent.error(img)

    // Should switch to character avatarUrl
    expect(img.src).toMatch(/\/avatars\/characters\/.+/)
  })
})
