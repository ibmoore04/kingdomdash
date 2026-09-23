import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeliveryOptionsCard } from '../delivery-options-card'

describe('DeliveryOptionsCard', () => {
  it('renders all three delivery options: standard, express, and scheduled', () => {
    const onSelect = vi.fn()
    render(
      <DeliveryOptionsCard
        selectedOption="standard"
        onSelectOption={onSelect}
        standardPrice={700}
        expressPrice={1300}
      />
    )

    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('Express')).toBeInTheDocument()
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
  })

  it('triggers onSelectOption when an option is clicked', () => {
    const onSelect = vi.fn()
    render(
      <DeliveryOptionsCard
        selectedOption="standard"
        onSelectOption={onSelect}
        standardPrice={700}
        expressPrice={1300}
      />
    )

    fireEvent.click(screen.getByText('Scheduled'))
    expect(onSelect).toHaveBeenCalledWith('scheduled')
  })

  it('displays the scheduled time slot picker when scheduled option is selected', () => {
    const onSelect = vi.fn()
    const onSelectDate = vi.fn()
    const onSelectSlot = vi.fn()

    render(
      <DeliveryOptionsCard
        selectedOption="scheduled"
        onSelectOption={onSelect}
        standardPrice={700}
        expressPrice={1300}
        scheduledSlot="11:00 AM - 01:00 PM"
        onSelectScheduledDate={onSelectDate}
        onSelectScheduledSlot={onSelectSlot}
      />
    )

    expect(screen.getByText('Select Delivery Window')).toBeInTheDocument()
    const slotSelect = screen.getByLabelText('Time Window') as HTMLSelectElement
    expect(slotSelect.value).toBe('11:00 AM - 01:00 PM')

    fireEvent.change(slotSelect, { target: { value: '01:00 PM - 03:00 PM' } })
    expect(onSelectSlot).toHaveBeenCalledWith('01:00 PM - 03:00 PM')
  })
})
