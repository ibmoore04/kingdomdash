import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/stores/auth-store';
import { getAuditLogs } from '../../services/supabase/admin';
import type { AuditLogRow } from '../../types/admin';
import {
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  FileCode,
} from 'lucide-react';

export const AdminAuditLogsPage: React.FC = () => {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector modal
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const loadLogs = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await getAuditLogs({ limit: 50 });
      setLogs((res.data || []) as unknown as AuditLogRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query audit trail');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Strict super_admin boundary check
  if (!isSuperAdmin) {
    return (
      <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-primary max-w-lg mx-auto text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-primary mx-auto" />
        <h2 className="text-base font-bold text-text-primary">Access Prohibited: Super Admin Role Required</h2>
        <p className="text-xs text-text-secondary">
          Forensic audit logs contain system-wide security telemetry and are restricted strictly to <code className="text-text-primary font-mono font-bold">super_admin</code> actors. 
          Your active profile has insufficient privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Forensic Audit Trail</h2>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Super Admin Only
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Append-only database-enforced security ledger • Track pricing changes, administrative approvals, and mutations
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-light-surface hover:bg-slate-100 rounded-xl transition-colors border border-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload Ledger</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-primary flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Mobile Cards View (md:hidden) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs">Scanning audit log ledger...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-text-muted bg-white border border-border rounded-2xl shadow-xs">
            <p className="text-xs">No audit records recorded yet.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-4 bg-white border border-border rounded-2xl shadow-xs space-y-2.5 font-mono"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-primary uppercase text-[11px] px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                  {log.action}
                </span>
                <span className="text-text-muted text-[10px]">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-light-surface p-2.5 rounded-xl border border-border">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase">Actor</span>
                  <span className="text-text-primary font-semibold truncate block">
                    {log.user_id ? `${log.user_id.slice(0, 8)}...` : 'SYSTEM_RPC'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase">Entity</span>
                  <span className="text-text-secondary truncate block">
                    {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 6)}...)` : ''}
                  </span>
                </div>
              </div>

              {log.details && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    className="px-3 py-1.5 rounded-xl bg-light-surface border border-border hover:bg-slate-100 text-text-secondary text-xs font-semibold transition-colors"
                  >
                    View Diff Payload
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block rounded-2xl bg-white border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-secondary">
            <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor / User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary mx-auto mb-1" />
                    Scanning audit log ledger...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-light-surface/60 transition-colors font-mono">
                    <td className="px-4 py-3 text-text-muted text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-text-primary text-[11px] font-semibold">
                      {log.user_id ? `${log.user_id.slice(0, 8)}...` : 'SYSTEM_RPC'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary uppercase text-[10px]">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-[11px]">
                      {log.entity_type}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-[10px]">
                      {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.details ? (
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 rounded-lg bg-light-surface border border-border hover:bg-slate-100 text-text-secondary text-[10px] transition-colors"
                        >
                          View Diff
                        </button>
                      ) : (
                        <span className="text-text-muted text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Inspector */}
      {selectedLog && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Audit Telemetry Payload
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-text-muted hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-light-surface border border-border max-h-72 overflow-y-auto font-mono text-[11px] text-text-primary">
              <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1.5 text-xs text-text-secondary bg-light-surface border border-border hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminAuditLogsPage;
