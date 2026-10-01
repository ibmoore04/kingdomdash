import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { Eye, LogOut, ShieldAlert, Clock, AlertTriangle } from 'lucide-react'

export const ImpersonationBanner: React.FC = () => {
  const { impersonation, isImpersonating, stopImpersonation } = useAuthStore()
  const [exiting, setExiting] = useState(false)
  const navigate = useNavigate()

  if (!isImpersonating || !impersonation) {
    return null
  }

  const { originalAdminProfile, targetProfile, reason, startedAt } = impersonation

  const handleExit = async () => {
    try {
      setExiting(true)
      await stopImpersonation()
      navigate('/admin/users', { replace: true })
    } finally {
      setExiting(false)
    }
  }

  const roleBadgeStyles: Record<string, string> = {
    customer: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
    rider: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    vendor: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
    admin: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
  }

  return (
    <aside
      role="status"
      aria-label="Admin Impersonation Banner"
      className="sticky top-0 z-50 w-full bg-slate-950 text-white border-b-2 border-amber-500 shadow-xl backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Left Information Section */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 shrink-0">
            <Eye className="w-4 h-4 text-amber-400" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider uppercase text-[11px] text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 inline" />
                Admin Mode:
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  roleBadgeStyles[targetProfile.role] || 'bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                Viewing as {targetProfile.role}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-200 font-medium truncate">
              <span className="font-semibold text-white truncate">{targetProfile.full_name}</span>
              <span className="text-slate-400 text-[11px] font-mono truncate">({targetProfile.email})</span>
            </div>
          </div>
        </div>

        {/* Right Metadata & Action */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 truncate max-w-xs" title={reason}>
              Reason: <span className="text-slate-300 italic">{reason}</span>
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />
              {new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <button
            type="button"
            disabled={exiting}
            onClick={handleExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{exiting ? 'Exiting...' : 'Return to Admin'}</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
