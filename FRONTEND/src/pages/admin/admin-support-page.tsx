import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  HelpCircle,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  User,
  Mail,
  Phone,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  getAllSupportTickets,
  updateSupportTicketStatus,
  type SupportTicket,
} from '@/services/supabase/support'

export const AdminSupportPage: React.FC = () => {
  const { pushToast } = useToast()
  const [searchParams] = useSearchParams()
  const urlRef = searchParams.get('ref')

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>(urlRef || '')

  // Active selected ticket for viewing / responding
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [adminResponseText, setAdminResponseText] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)

  const loadTickets = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data } = await getAllSupportTickets({
        status: statusFilter,
        category: categoryFilter,
        search: searchQuery,
      })
      const list = data || []
      setTickets(list)

      if (urlRef && list.length > 0) {
        const match = list.find(
          (t) =>
            t.reference_code.toLowerCase() === urlRef.toLowerCase() ||
            t.id.toLowerCase() === urlRef.toLowerCase()
        )
        if (match) {
          setSelectedTicket(match)
          setAdminResponseText(match.admin_response || '')
        }
      }
    } catch {
      setTickets([])
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, categoryFilter, searchQuery, urlRef])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const handleSelectTicket = (t: SupportTicket) => {
    setSelectedTicket(t)
    setAdminResponseText(t.admin_response || '')
  }

  const handleUpdateStatus = async (
    newStatus: SupportTicket['status'],
    responseText?: string
  ) => {
    if (!selectedTicket) return
    setIsUpdating(true)

    try {
      const { data, error } = await updateSupportTicketStatus(
        selectedTicket.reference_code || selectedTicket.id,
        newStatus,
        responseText || adminResponseText
      )

      if (error || !data) {
        pushToast({
          variant: 'error',
          title: 'Update Failed',
          message: error?.message || 'Could not update support ticket status.',
        })
        return
      }

      setSelectedTicket(data)
      pushToast({
        variant: 'success',
        title: 'Support Ticket Updated',
        message: `Ticket ${data.reference_code} updated to ${newStatus.toUpperCase()}. Customer notified.`,
      })
      loadTickets()
    } catch {
      pushToast({
        variant: 'error',
        title: 'Error',
        message: 'Network error updating support ticket.',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // Statistics counts
  const totalCount = tickets.length
  const newCount = tickets.filter((t) => t.status === 'new').length
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length
  const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-border shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary flex items-center gap-2.5">
            <HelpCircle className="w-6 h-6 text-primary" />
            <span>Support & Report Center</span>
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Track, inspect, and respond to user support requests and reference codes in real-time.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadTickets}
          className="rounded-xl font-bold text-xs gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Desk</span>
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-border shadow-xs space-y-1">
          <span className="text-xs font-semibold text-text-muted">Total Tickets</span>
          <p className="text-2xl font-extrabold text-text-primary">{totalCount}</p>
        </div>
        <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-amber-800">New / Pending</span>
          <p className="text-2xl font-extrabold text-amber-900">{newCount}</p>
        </div>
        <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200/80 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-blue-800">Under Review</span>
          <p className="text-2xl font-extrabold text-blue-900">{inProgressCount}</p>
        </div>
        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-emerald-800">Resolved / Closed</span>
          <p className="text-2xl font-extrabold text-emerald-900">{resolvedCount}</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search by Reference Code / Email / Name */}
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Search Reference Code (e.g. KD-SUP-847291), Email, or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9 text-xs sm:text-sm bg-white"
          />
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-3" />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 text-xs font-semibold">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New / Pending</SelectItem>
              <SelectItem value="in_progress">Under Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category Filter */}
        <div className="w-full sm:w-48">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 text-xs font-semibold">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="account_inactive">Account Inactivity</SelectItem>
              <SelectItem value="order_issue">Order / Delivery</SelectItem>
              <SelectItem value="vendor_inquiry">Vendor Inquiry</SelectItem>
              <SelectItem value="rider_inquiry">Rider Inquiry</SelectItem>
              <SelectItem value="payment_issue">Billing & Payment</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content Grid: Tickets List + Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tickets List */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-border p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Tickets ({tickets.length})
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-text-muted">Loading support desk...</div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">
              No support tickets found matching criteria.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {tickets.map((t) => {
                const isSelected = selectedTicket?.reference_code === t.reference_code
                return (
                  <button
                    key={t.id || t.reference_code}
                    onClick={() => handleSelectTicket(t)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-2 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-border bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-primary bg-white px-2 py-0.5 rounded border border-primary/20">
                        {t.reference_code}
                      </span>
                      {getStatusBadge(t.status)}
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-text-primary truncate">{t.subject}</h4>
                      <p className="text-[11px] text-text-secondary truncate">
                        {t.name} &bull; {t.email}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-text-muted pt-1">
                      <span>Cat: {t.category.toUpperCase()}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Ticket Detail Inspector */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-border p-6 shadow-xs space-y-5">
          {!selectedTicket ? (
            <div className="py-20 text-center space-y-2">
              <HelpCircle className="w-10 h-10 text-neutral-300 mx-auto" />
              <p className="text-xs font-bold text-text-primary">Select a ticket to inspect details</p>
              <p className="text-[11px] text-text-muted">
                Click any ticket from the list on the left to review reports and send official replies.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header Info */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">
                    Support Ticket Reference
                  </span>
                  <span className="font-mono text-lg font-extrabold text-primary">
                    {selectedTicket.reference_code}
                  </span>
                </div>
                {getStatusBadge(selectedTicket.status)}
              </div>

              {/* Customer Contact Card */}
              <div className="p-4 rounded-xl bg-light-surface border border-border space-y-2 text-xs">
                <span className="font-bold text-text-primary block">Complainant Information:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-text-muted" />
                    <span className="font-semibold text-text-primary">{selectedTicket.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-text-muted" />
                    <span>{selectedTicket.email}</span>
                  </div>
                  {selectedTicket.phone && (
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Phone className="w-3.5 h-3.5 text-text-muted" />
                      <span>{selectedTicket.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Subject & Message Content */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-text-secondary block">Report Details:</span>
                <div className="p-4 rounded-xl border border-border bg-white text-xs space-y-2">
                  <h3 className="font-bold text-text-primary text-sm">{selectedTicket.subject}</h3>
                  <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.message}
                  </p>
                </div>
              </div>

              {/* Status Update Action Bar */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-xs font-bold text-text-primary block">Update Ticket Status:</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={selectedTicket.status === 'new' ? 'primary' : 'outline'}
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus('new')}
                    className="text-xs font-bold"
                  >
                    Re-open (New)
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedTicket.status === 'in_progress' ? 'primary' : 'outline'}
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus('in_progress')}
                    className="text-xs font-bold"
                  >
                    Set Under Review
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedTicket.status === 'resolved' ? 'primary' : 'outline'}
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus('resolved')}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Mark Resolved
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedTicket.status === 'closed' ? 'primary' : 'outline'}
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus('closed')}
                    className="text-xs font-bold"
                  >
                    Close Ticket
                  </Button>
                </div>
              </div>

              {/* Admin Official Response Area */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-text-primary block">
                  Official Admin Reply (Notifies Customer):
                </span>
                <Textarea
                  rows={4}
                  placeholder="Type your official response to the customer..."
                  value={adminResponseText}
                  onChange={(e) => setAdminResponseText(e.target.value)}
                  className="text-xs sm:text-sm p-3"
                />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isUpdating || !adminResponseText.trim()}
                  onClick={() => handleUpdateStatus(selectedTicket.status, adminResponseText)}
                  className="w-full sm:w-auto font-bold text-xs gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Response & Notify Customer</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminSupportPage
