import React, { useState, useEffect, useCallback } from 'react';
import { getUsers, toggleUserActive, getCorporateLeads, updateCorporateLeadStatus, type CorporateLeadRow } from '../../services/supabase/admin';
import type { AdminUserRow } from '../../types/admin';
import { useAuthStore } from '@/stores/auth-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Search,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  Clock,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'corporate'>(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') === 'corporate' ? 'corporate' : 'users';
    }
    return 'users';
  });

  const handleTabChange = (tab: 'users' | 'corporate') => {
    setActiveTab(tab);
    setPage(1);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      const url = new URL(window.location.href);
      if (tab === 'corporate') {
        url.searchParams.set('tab', 'corporate');
      } else {
        url.searchParams.delete('tab');
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  const currentProfile = useAuthStore((s) => s.profile);
  const isSuperAdmin = currentProfile?.role === 'super_admin';

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Corporate Leads State
  const [corporateLeads, setCorporateLeads] = useState<CorporateLeadRow[]>([]);
  const [corporateCount, setCorporateCount] = useState(0);
  const [leadStatusFilter, setLeadStatusFilter] = useState('all');

  const pageSize = 15;

  const loadCorporateLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (typeof getCorporateLeads === 'function') {
        const res = await getCorporateLeads({
          page,
          limit: pageSize,
          status: leadStatusFilter !== 'all' ? leadStatusFilter : undefined,
        });
        setCorporateLeads(res.data || []);
        setCorporateCount(res.count || 0);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve corporate leads');
    } finally {
      setLoading(false);
    }
  }, [page, leadStatusFilter]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getUsers({
        page,
        limit: pageSize,
        search: search || undefined,
        role: roleFilter || undefined,
      });
      setUsers((res.data || []) as unknown as AdminUserRow[]);
      setTotalCount(res.count || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve users');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    // Always keep corporate leads count fresh for tab counter
    loadCorporateLeads();
  }, [loadCorporateLeads]);

  useEffect(() => {
    if (activeTab === 'corporate') {
      loadCorporateLeads();
    } else {
      loadUsers();
    }
  }, [activeTab, loadUsers, loadCorporateLeads]);

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      setActionLoading(userId);
      setError(null);
      const res = await toggleUserActive(userId, !currentStatus);
      if (res.error) {
        setError(res.error.message || 'Operation failed');
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: !currentStatus } : u))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateLeadStatus = async (
    id: string,
    status: 'pending' | 'contacted' | 'onboarded' | 'rejected'
  ) => {
    try {
      setActionLoading(id);
      if (typeof updateCorporateLeadStatus === 'function') {
        await updateCorporateLeadStatus(id, status);
        setCorporateLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status } : l))
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update lead status');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => handleTabChange('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'users'
              ? 'bg-primary text-white shadow-xs'
              : 'text-text-secondary hover:bg-light-surface'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Accounts</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-light-surface text-text-muted'
            }`}
          >
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('corporate')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'corporate'
              ? 'bg-primary text-white shadow-xs'
              : 'text-text-secondary hover:bg-light-surface'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Corporate Leads</span>
          {corporateCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'corporate' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
              }`}
            >
              {corporateCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'corporate' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Corporate Account Leads</h2>
                <p className="text-xs text-text-secondary">
                  {corporateCount} B2B logistics inquiries from Ijebu-Ode businesses
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={leadStatusFilter}
                onValueChange={(val) => {
                  setLeadStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36 bg-white border border-border rounded-xl text-xs text-text-primary focus:border-primary shadow-xs capitalize h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="onboarded">Onboarded</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <button
                type="button"
                onClick={loadCorporateLeads}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-light-surface hover:bg-slate-100 rounded-xl transition-colors border border-border"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Reload</span>
              </button>
            </div>
          </div>

          {/* Mobile Leads Cards (md:hidden) */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs">Loading corporate inquiries...</p>
              </div>
            ) : corporateLeads.length === 0 ? (
              <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
                <p className="text-xs">No corporate leads found.</p>
              </div>
            ) : (
              corporateLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 bg-white border border-border rounded-2xl shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-text-primary text-sm">{lead.company_name}</div>
                      <div className="text-xs text-text-muted">{lead.contact_name}</div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                        lead.status === 'onboarded'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : lead.status === 'contacted'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : lead.status === 'rejected'
                          ? 'bg-rose-50 text-primary border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {lead.status}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-light-surface border border-border space-y-1.5 text-xs">
                    <div className="font-mono text-text-primary flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      {lead.phone}
                    </div>
                    {lead.email && (
                      <div className="text-text-muted flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-text-muted" />
                        {lead.email}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white text-text-secondary border border-border">
                        {lead.business_type}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {lead.estimated_volume || 'Standard Volume'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border">
                    {lead.status !== 'contacted' && lead.status !== 'onboarded' && (
                      <button
                        type="button"
                        disabled={actionLoading === lead.id}
                        onClick={() => handleUpdateLeadStatus(lead.id, 'contacted')}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      >
                        Contacted
                      </button>
                    )}
                    {lead.status !== 'onboarded' && (
                      <button
                        type="button"
                        disabled={actionLoading === lead.id}
                        onClick={() => handleUpdateLeadStatus(lead.id, 'onboarded')}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      >
                        Onboard
                      </button>
                    )}
                    {lead.status !== 'rejected' && (
                      <button
                        type="button"
                        disabled={actionLoading === lead.id}
                        onClick={() => handleUpdateLeadStatus(lead.id, 'rejected')}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Leads Table (hidden md:block) */}
          <div className="hidden md:block rounded-2xl bg-white border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-text-secondary">
                <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Company & Contact</th>
                    <th className="px-4 py-3">Contact Details</th>
                    <th className="px-4 py-3">Business Info</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                        <div className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                          <span>Loading corporate inquiries...</span>
                        </div>
                      </td>
                    </tr>
                  ) : corporateLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                        No corporate leads found.
                      </td>
                    </tr>
                  ) : (
                    corporateLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-light-surface/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-text-primary">{lead.company_name}</div>
                          <div className="text-[11px] text-text-muted">{lead.contact_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-text-primary flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            {lead.phone}
                          </div>
                          {lead.email && (
                            <div className="text-[11px] text-text-muted flex items-center gap-1">
                              <Mail className="w-3 h-3 text-text-muted" />
                              {lead.email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface text-text-secondary border border-border">
                            {lead.business_type}
                          </span>
                          <div className="text-[10px] text-text-muted mt-0.5">
                            {lead.estimated_volume || 'Standard Volume'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                              lead.status === 'onboarded'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : lead.status === 'contacted'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : lead.status === 'rejected'
                                ? 'bg-rose-50 text-primary border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {lead.status !== 'contacted' && lead.status !== 'onboarded' && (
                              <button
                                type="button"
                                disabled={actionLoading === lead.id}
                                onClick={() => handleUpdateLeadStatus(lead.id, 'contacted')}
                                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                              >
                                Contacted
                              </button>
                            )}
                            {lead.status !== 'onboarded' && (
                              <button
                                type="button"
                                disabled={actionLoading === lead.id}
                                onClick={() => handleUpdateLeadStatus(lead.id, 'onboarded')}
                                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                              >
                                Onboard
                              </button>
                            )}
                            {lead.status !== 'rejected' && (
                              <button
                                type="button"
                                disabled={actionLoading === lead.id}
                                onClick={() => handleUpdateLeadStatus(lead.id, 'rejected')}
                                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Platform User Accounts</h2>
            <p className="text-xs text-text-secondary">
              {totalCount} total registered profiles across all roles
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-light-surface hover:bg-slate-100 rounded-xl transition-colors border border-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-primary shadow-xs transition-colors"
          />
        </div>

        {/* Role Filter */}
        <div className="relative">
          <Select
            value={roleFilter || 'all'}
            onValueChange={(val) => {
              setRoleFilter(val === 'all' ? '' : val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full bg-white border border-border rounded-xl text-xs text-text-primary focus:border-primary shadow-xs transition-colors capitalize h-9">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="rider">Rider</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {/* Active status filter */}
        <Select
          value={activeFilter === undefined ? 'all' : String(activeFilter)}
          onValueChange={(val) => {
            setActiveFilter(val === 'all' ? undefined : val === 'true');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full bg-white border border-border rounded-xl text-xs text-text-primary focus:border-primary shadow-xs transition-colors h-9">
            <SelectValue placeholder="All Account States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Account States</SelectItem>
            <SelectItem value="true">Active Accounts Only</SelectItem>
            <SelectItem value="false">Suspended / Deactivated Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-primary flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Mobile Users Cards (md:hidden) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs">Loading user records...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
            <p className="text-xs">No users matching criteria.</p>
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="p-4 bg-white border border-border rounded-2xl shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-text-primary text-sm">
                    {user.full_name || 'Unnamed User'}
                  </div>
                  <div className="text-[11px] font-mono text-text-secondary">
                    {user.phone_number || 'No phone'}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-light-surface text-text-secondary border border-border">
                  <Shield className="w-2.5 h-2.5 text-primary" />
                  {user.role}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  {user.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-primary border border-rose-200">
                      <XCircle className="w-3 h-3" />
                      Suspended
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted font-mono">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>

                {user.role === 'super_admin' && !isSuperAdmin ? null : (
                  <button
                    type="button"
                    disabled={
                      actionLoading === user.id ||
                      (user.id === currentProfile?.id && user.is_active)
                    }
                    title={
                      user.id === currentProfile?.id && user.is_active
                        ? 'You cannot deactivate your own account'
                        : undefined
                    }
                    onClick={() => handleToggleActive(user.id, user.is_active)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs ${
                      user.is_active
                        ? 'bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    {actionLoading === user.id
                      ? 'Updating...'
                      : user.is_active
                      ? 'Deactivate'
                      : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Users Table (hidden md:block) */}
      <div className="hidden md:block rounded-2xl bg-white border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-secondary">
            <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading user records...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-light-surface/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-primary">{user.full_name || 'Unnamed User'}</div>
                      <div className="text-[10px] text-text-muted font-mono">{user.id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{user.phone_number || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-light-surface text-text-secondary border border-border">
                        <Shield className="w-2.5 h-2.5 text-primary" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-primary border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.role === 'super_admin' && !isSuperAdmin ? null : (
                        <button
                          type="button"
                          disabled={
                            actionLoading === user.id ||
                            (user.id === currentProfile?.id && user.is_active)
                          }
                          title={
                            user.id === currentProfile?.id && user.is_active
                              ? 'You cannot deactivate your own account'
                              : undefined
                          }
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                            user.is_active
                              ? 'bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {actionLoading === user.id
                            ? 'Updating...'
                            : user.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-text-secondary">
          <div>
            Showing Page <span className="font-semibold text-text-primary">{page}</span> of{' '}
            <span className="font-semibold text-text-primary">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-lg bg-light-surface border border-border text-text-secondary hover:text-text-primary hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg bg-light-surface border border-border text-text-secondary hover:text-text-primary hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default AdminUsersPage;
