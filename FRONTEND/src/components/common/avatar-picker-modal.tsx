import React, { useState } from 'react'
import { Crown, Sparkles, Check, Shuffle, CheckCircle, Shield } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KingdomAvatar } from '@/components/common/kingdom-avatar'
import {
  KINGDOMDASH_AVATAR_ROSTER,
  type AvatarCharacter,
  type AvatarType,
  getDefaultAvatar,
  getAvatarByUrlOrId,
} from '@/constants/avatar-roster'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { supabase } from '@/services/supabase/client'
import { cn } from '@/lib/cn'

export interface AvatarPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAvatarSaved?: (newAvatarUrl: string) => void
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  open,
  onOpenChange,
  onAvatarSaved,
}) => {
  const { profile } = useAuthStore()
  const pushToast = useUiStore((state) => state.pushToast)

  // Find initial avatar or default
  const defaultChar = getDefaultAvatar(profile?.id, profile?.full_name, profile?.role)
  const initialChar = getAvatarByUrlOrId(profile?.avatar_url) || defaultChar

  const [selectedCharacter, setSelectedCharacter] = useState<AvatarCharacter>(initialChar)
  const [filterType, setFilterType] = useState<'all' | AvatarType>('all')
  const [isSaving, setIsSaving] = useState(false)

  // Filter roster
  const filteredRoster = KINGDOMDASH_AVATAR_ROSTER.filter((char) => {
    if (filterType === 'all') return true
    return char.type === filterType
  })

  const handleRandomize = () => {
    const randomIndex = Math.floor(Math.random() * KINGDOMDASH_AVATAR_ROSTER.length)
    setSelectedCharacter(KINGDOMDASH_AVATAR_ROSTER[randomIndex])
  }

  const handleSaveAvatar = async () => {
    if (!profile?.id) {
      pushToast({
        variant: 'error',
        title: 'Sign In Required',
        message: 'Please sign in to save your character avatar.',
      })
      return
    }

    setIsSaving(true)
    try {
      // 1. Authoritative Backend Update: Try server RPC equip_avatar first, fallback to direct table update
      let saveError: any = null
      try {
        const { error: rpcErr } = await (supabase.rpc as any)('equip_avatar', {
          p_avatar_url: selectedCharacter.avatarUrl,
        })
        if (rpcErr) {
          saveError = rpcErr
        }
      } catch (e) {
        saveError = e
      }

      if (saveError) {
        const { error: tableErr } = await supabase
          .from('profiles')
          .update({ avatar_url: selectedCharacter.avatarUrl })
          .eq('id', profile.id)

        if (tableErr) {
          throw tableErr
        }
      }

      // 2. Synchronize Zustand auth-store profile state
      useAuthStore.setState({
        profile: {
          ...profile,
          avatar_url: selectedCharacter.avatarUrl,
        },
      })

      pushToast({
        variant: 'success',
        title: 'Character Equipped',
        message: `${selectedCharacter.name} equipped as your official KingdomDash character!`,
      })

      onAvatarSaved?.(selectedCharacter.avatarUrl)
      onOpenChange(false)
    } catch (err: any) {
      pushToast({
        variant: 'error',
        title: 'Update Failed',
        message: err?.message || 'Failed to update avatar. Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 bg-white border border-border rounded-2xl shadow-2xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Crown className="h-4 w-4" />
            </span>
            <DialogTitle className="text-h3 font-bold text-neutral-900">
              Choose KingdomDash Character
            </DialogTitle>
          </div>
          <DialogDescription className="text-body-small text-text-secondary">
            Select your official royal vinyl doll or anime character avatar. Every KingdomDash user
            is assigned a unique character persona!
          </DialogDescription>
        </DialogHeader>

        {/* Selected Persona Showcase Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white p-4 sm:p-5 mb-5 shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 relative z-10">
            <KingdomAvatar
              size="2xl"
              avatarUrl={selectedCharacter.avatarUrl}
              name={selectedCharacter.name}
              showBadge={true}
              className="ring-4 ring-amber-400 shadow-xl"
            />
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h4 className="text-h4 font-bold text-white tracking-tight">
                  {selectedCharacter.name}
                </h4>
                <Badge
                  variant={selectedCharacter.type === 'doll' ? 'warning' : 'error'}
                  className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5"
                >
                  {selectedCharacter.type === 'doll' ? (
                    <span className="inline-flex items-center gap-1">
                      <Crown className="h-3 w-3" /> 3D Vinyl Doll
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Anime Hero
                    </span>
                  )}
                </Badge>
              </div>
              <p className="text-xs font-semibold text-amber-400 mb-1.5">
                {selectedCharacter.title} • {selectedCharacter.tagline}
              </p>
              <p className="text-xs text-neutral-300 leading-relaxed max-w-lg">
                {selectedCharacter.description}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRandomize}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
              title="Pick a random character"
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>Random</span>
            </button>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                'px-3 py-1.5 text-xs font-bold rounded-lg transition-all',
                filterType === 'all'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              All ({KINGDOMDASH_AVATAR_ROSTER.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('doll')}
              className={cn(
                'px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1',
                filterType === 'doll'
                  ? 'bg-white text-amber-600 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              <Crown className="h-3 w-3" />
              3D Dolls (5)
            </button>
            <button
              type="button"
              onClick={() => setFilterType('anime')}
              className={cn(
                'px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1',
                filterType === 'anime'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              <Sparkles className="h-3 w-3" />
              Anime (7)
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-text-muted">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span>KingdomDash Verified</span>
          </div>
        </div>

        {/* Character Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
          {filteredRoster.map((char) => {
            const isSelected = selectedCharacter.id === char.id
            const isEquipped = profile?.avatar_url === char.avatarUrl

            return (
              <div
                key={char.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCharacter(char)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedCharacter(char)
                  }
                }}
                className={cn(
                  'group relative flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-md -translate-y-0.5'
                    : 'border-border bg-neutral-50/70 hover:bg-neutral-100 hover:border-neutral-300'
                )}
              >
                {/* Active check indicator */}
                {isSelected && (
                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-xs">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}

                {/* Avatar Preview */}
                <div className="relative mb-2 mt-1">
                  <KingdomAvatar
                    size="lg"
                    avatarUrl={char.avatarUrl}
                    name={char.name}
                    showBadge={false}
                    className={cn(
                      'transition-transform duration-200 group-hover:scale-105',
                      isSelected ? 'ring-2 ring-primary' : ''
                    )}
                  />
                  {char.type === 'doll' ? (
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-neutral-950 shadow-xs text-[9px] font-bold">
                      <Crown className="h-2.5 w-2.5" />
                    </span>
                  ) : (
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white shadow-xs text-[9px] font-bold">
                      <Sparkles className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>

                <span className="text-xs font-bold text-neutral-900 truncate w-full">
                  {char.name}
                </span>
                <span className="text-[10px] text-text-muted truncate w-full">{char.title}</span>

                {isEquipped && (
                  <Badge variant="outline" className="mt-1 text-[9px] py-0 px-1 border-primary/40 text-primary">
                    Equipped
                  </Badge>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-5 mt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-text-muted hover:text-text-primary"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isSaving}
            onClick={handleSaveAvatar}
            className="gap-2 font-bold text-white bg-primary hover:bg-primary-hover shadow-sm"
          >
            {isSaving ? (
              'Equipping...'
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Equip {selectedCharacter.name}</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
