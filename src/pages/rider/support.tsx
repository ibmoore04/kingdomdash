import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { useCurrentRider } from '@/hooks/use-current-rider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  getUserSupportTickets,
  getSupportTicketByReference,
  type SupportTicket,
} from '@/services/supabase/support'
import {
  HelpCircle,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldAlert,
  Bike,
} from 'lucide-react'

export default function RiderSupportPage() {
  const { rider } = useCurrentRider()
  const [searchParams] = useSearchParams()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [trackInput, setTrackInput] = useState('')
  const [trackResult, setTrackResult] = useState<SupportTicket | null>(null)
  const [trackError, setTrackError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const urlRefParam = searchParams.get('ref')

  const loadRiderTickets = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data } = await getUserSupportTickets(rider?.email)
      setTickets(data || [])
    } catch {
      setTickets([])
    } finally {
      setIsLoading(false)
    }
  }, [rider?.email])

  useEffect(() => {
    loadRiderTickets()
  }, [loadRiderTickets])

  useEffect(() => {
    if (urlRefParam) {
      setTrackInput(urlRefParam)
      handleSearchReference(urlRefParam)
    }
  }, [urlRefParam])

  const handleSearchReference = async (refCode: string) => {
    if (!refCode.trim()) return
    setIsSearching(true)
    setTrackError(null)
    setTrackResult(null)

    try {
      const { data, error } = await getSupportTicketByReference(refCode.trim())
      if (error || !data) {
        setTrackError(error?.message || `No support ticket found for reference "${refCode}".`)
      } else {
        setTrackResult(data)
      }
    } catch {
      setTrackError('Error searching reference number.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearchReference(trackInput)
  }

  const getStatusBadge = (status: SupportTicket['status']) => {
    switch (status) {
      case 'new':
        return (
          <Badge variant="warning" className="bg-amber-50 text-amber-800 border border-amber-300 font-bold gap-1">
            <Clock className="w-3 h-3" />
            <span>New / Pending</span>
          </Badge>
        )
      case 'in_progress':
        return (
          <Badge variant="info" className="bg-blue-50 text-blue-800 border border-blue-300 font-bold gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Under Review</span>
          </Badge>
        )
      case 'resolved':
        return (
          <Badge variant="success" className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Resolved</span>
          </Badge>
        )
      case 'closed':
        return (
          <Badge variant="default" className="bg-neutral-100 text-neutral-700 border border-neutral-300 font-bold gap-1">
            <span>Closed</span>
          </Badge>
        )
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  return (
    <RiderLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-border shadow-xs">
          <div>
            <h1 className="text-xl font-extrabold text-text-primary flex items-center gap-2">
              <Bike className="w-5 h-5 text-primary" />
              <span>Rider Support & Operations Help Desk</span>
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Submit fleet support tickets, track issues by Reference Code, or view admin responses.
            </p>
          </div>
          <Button asChild variant="primary" className="rounded-xl px-5 font-bold text-xs gap-2 shrink-0">
            <Link to="/support?reason=rider_inquiry">
              <Plus className="w-4 h-4" />
              <span>Log Rider Support Ticket</span>
            </Link>
          </Button>
        </div>

        {/* ── 1. REFERENCE NUMBER TRACKER ────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-primary/5 via-white to-primary/5 p-6 rounded-2xl border border-primary/20 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-text-primary">Track Report by Reference Number</h2>
          </div>

          <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Input
                type="text"
                placeholder="e.g. KD-SUP-847291 or Ticket UUID"
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                className="h-11 pl-10 text-xs sm:text-sm font-mono uppercase bg-white border-border"
              />
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-3.5" />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={isSearching || !trackInput.trim()}
              className="w-full sm:w-auto h-11 px-6 font-bold text-xs shrink-0"
            >
              {isSearching ? 'Searching...' : 'Track Ticket'}
            </Button>
          </form>

          {trackError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{trackError}</span>
            </div>
          )}

          {trackResult && (
            <div className="p-5 rounded-2xl bg-white border-2 border-primary/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">
                    Reference Code
                  </span>
                  <span className="font-mono text-base font-extrabold text-primary">
                    {trackResult.reference_code}
                  </span>
                </div>
                {getStatusBadge(trackResult.status)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-text-muted block">Subject:</span>
                  <span className="font-bold text-text-primary">{trackResult.subject}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Submitted:</span>
                  <span className="font-semibold text-text-primary">
                    {new Date(trackResult.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-light-surface p-3.5 rounded-xl border border-border text-xs space-y-1">
                <span className="font-bold text-text-secondary block">Report Message:</span>
                <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
                  {trackResult.message}
                </p>
              </div>

              {trackResult.admin_response && (
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Official Dispatch / Admin Response</span>
                    {trackResult.admin_responded_at && (
                      <span className="text-[10px] text-emerald-700 font-normal ml-auto">
                        {new Date(trackResult.admin_responded_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-emerald-950 font-medium whitespace-pre-wrap leading-relaxed pl-6">
                    {trackResult.admin_response}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 2. RIDER SUPPORT TICKETS HISTORY ────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-border p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-base font-bold text-text-primary">Rider Fleet Support History</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadRiderTickets}
              className="text-xs font-semibold gap-1.5 text-text-secondary hover:text-primary"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-text-muted">
              Loading rider support tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <HelpCircle className="w-10 h-10 text-neutral-300 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-text-primary">No Rider Support Requests</p>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  You haven&apos;t submitted any support requests under {rider?.email || 'your email'}.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-xl font-bold text-xs">
                <Link to="/support?reason=rider_inquiry">Submit Rider Ticket</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div
                  key={t.id || t.reference_code}
                  className="p-5 rounded-xl border border-border bg-white hover:border-primary/40 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {t.reference_code}
                      </span>
                      <span className="text-xs font-bold text-text-primary">{t.subject}</span>
                    </div>
                    {getStatusBadge(t.status)}
                  </div>

                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                    {t.message}
                  </p>

                  {t.admin_response && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Admin Reply:</span>
                      </div>
                      <p className="pl-5 text-emerald-950">{t.admin_response}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-text-muted">
                    <span>Category: {t.category.toUpperCase()}</span>
                    <span>Submitted: {new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RiderLayout>
  )
}
