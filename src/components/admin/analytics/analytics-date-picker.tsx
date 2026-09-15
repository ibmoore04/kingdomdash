import { useState } from 'react'
import { Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AdminDateRangePreset } from '@/types/admin'

interface AnalyticsDatePickerProps {
  preset: AdminDateRangePreset
  startDate?: string
  endDate?: string
  onRangeChange: (preset: AdminDateRangePreset, start?: string, end?: string) => void
  isLoading?: boolean
}

export function AnalyticsDatePicker({
  preset,
  startDate,
  endDate,
  onRangeChange,
  isLoading = false,
}: AnalyticsDatePickerProps) {
  const [showCustom, setShowCustom] = useState(preset === 'custom')
  const [customStart, setCustomStart] = useState(
    startDate ? startDate.split('T')[0] : ''
  )
  const [customEnd, setCustomEnd] = useState(
    endDate ? endDate.split('T')[0] : ''
  )

  const handlePresetClick = (p: AdminDateRangePreset) => {
    if (p === 'custom') {
      setShowCustom(true)
      return
    }

    setShowCustom(false)
    const now = new Date()
    let start: Date

    if (p === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    } else if (p === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (p === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else {
      // 90d
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    }

    onRangeChange(p, start.toISOString(), now.toISOString())
  }

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customStart || !customEnd) return

    const start = new Date(`${customStart}T00:00:00+01:00`).toISOString()
    const end = new Date(`${customEnd}T23:59:59.999+01:00`).toISOString()
    onRangeChange('custom', start, end)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-border bg-surface-muted p-1 text-caption">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => handlePresetClick('today')}
          className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
            preset === 'today'
              ? 'bg-white text-text-primary shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Today
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => handlePresetClick('7d')}
          className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
            preset === '7d'
              ? 'bg-white text-text-primary shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          7 Days
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => handlePresetClick('30d')}
          className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
            preset === '30d'
              ? 'bg-white text-text-primary shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          30 Days
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => handlePresetClick('90d')}
          className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
            preset === '90d'
              ? 'bg-white text-text-primary shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          90 Days
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => handlePresetClick('custom')}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
            preset === 'custom'
              ? 'bg-white text-text-primary shadow-xs'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Calendar className="h-3 w-3" aria-hidden="true" />
          Custom
        </button>
      </div>

      {showCustom && (
        <form onSubmit={handleApplyCustom} className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="rounded-lg border border-border bg-white px-2.5 py-1 text-caption text-text-primary focus:border-primary focus:outline-none"
            aria-label="Start date"
            required
          />
          <span className="text-caption text-text-muted">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="rounded-lg border border-border bg-white px-2.5 py-1 text-caption text-text-primary focus:border-primary focus:outline-none"
            aria-label="End date"
            required
          />
          <Button type="submit" size="sm" variant="primary" disabled={isLoading} className="h-7 px-2 text-caption font-bold text-white bg-primary hover:bg-primary-hover">
            <Filter className="h-3 w-3 mr-1" />
            Apply
          </Button>
        </form>
      )}
    </div>
  )
}
