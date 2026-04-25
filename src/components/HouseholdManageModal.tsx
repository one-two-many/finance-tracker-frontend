import { useEffect, useState } from 'react'
import { ShieldCheck, UserMinus, UserPlus, X, Trash2, LogOut } from 'lucide-react'
import {
  acceptInvitation as _accept,
  cancelHouseholdInvitation,
  createHousehold,
  declineInvitation as _decline,
  deleteHousehold,
  getHousehold,
  inviteToHousehold,
  listHouseholdInvitations,
  removeHouseholdMember,
  renameHousehold,
  type HouseholdDetail,
  type HouseholdInvitation,
  type HouseholdSummary,
} from '../services/api'
import { Button } from './ui/button'
import { Input } from './ui/input'

void _accept; void _decline // referenced for completeness; not used directly here

interface HouseholdManageModalProps {
  isOpen: boolean
  onClose: () => void
  /** When provided, the modal manages an existing household. When null, it creates a new one. */
  householdId: number | null
  /** Current user id — needed to detect "leave (self)" vs "remove (other)". */
  currentUserId: number
  onSuccess: (message: string) => void
  onError: (message: string) => void
  /** Called when the household is created/renamed/deleted/left so the parent can refresh. */
  onMutated: () => void
}

export default function HouseholdManageModal({
  isOpen,
  onClose,
  householdId,
  currentUserId,
  onSuccess,
  onError,
  onMutated,
}: HouseholdManageModalProps) {
  const isCreate = householdId === null

  const [detail, setDetail] = useState<HouseholdDetail | null>(null)
  const [pending, setPending] = useState<HouseholdInvitation[]>([])
  const [name, setName] = useState('')
  const [inviteValue, setInviteValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  const isAdmin = detail?.role === 'admin'

  useEffect(() => {
    if (!isOpen) return
    if (isCreate) {
      setDetail(null)
      setPending([])
      setName('')
      return
    }
    setLoading(true)
    Promise.all([getHousehold(householdId!), listHouseholdInvitations(householdId!)])
      .then(([d, invs]) => {
        setDetail(d)
        setName(d.name)
        setPending(invs)
      })
      .catch(() => onError('Failed to load household'))
      .finally(() => setLoading(false))
  }, [isOpen, householdId, isCreate, onError])

  if (!isOpen) return null

  const reload = async () => {
    if (householdId === null) return
    try {
      const [d, invs] = await Promise.all([
        getHousehold(householdId),
        listHouseholdInvitations(householdId),
      ])
      setDetail(d)
      setName(d.name)
      setPending(invs)
    } catch {
      // Silent — error path handled by the originating mutation
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      onError('Household name is required')
      return
    }
    setBusy(true)
    try {
      await createHousehold(name.trim())
      onSuccess(`Household "${name.trim()}" created`)
      onMutated()
      onClose()
    } catch (e) {
      onError(extractError(e, 'Failed to create household'))
    } finally {
      setBusy(false)
    }
  }

  const handleRename = async () => {
    if (!detail || !name.trim() || name.trim() === detail.name) return
    setBusy(true)
    try {
      await renameHousehold(detail.id, name.trim())
      onSuccess('Household renamed')
      onMutated()
      reload()
    } catch (e) {
      onError(extractError(e, 'Failed to rename'))
    } finally {
      setBusy(false)
    }
  }

  const handleInvite = async () => {
    if (!detail || !inviteValue.trim()) return
    setBusy(true)
    try {
      await inviteToHousehold(detail.id, inviteValue.trim())
      onSuccess(`Invitation sent to ${inviteValue.trim()}`)
      setInviteValue('')
      reload()
    } catch (e) {
      onError(extractError(e, 'Failed to send invitation'))
    } finally {
      setBusy(false)
    }
  }

  const handleCancelInvite = async (invitationId: number) => {
    if (!detail) return
    try {
      await cancelHouseholdInvitation(detail.id, invitationId)
      onSuccess('Invitation cancelled')
      reload()
    } catch (e) {
      onError(extractError(e, 'Failed to cancel invitation'))
    }
  }

  const handleRemoveMember = async (userId: number, isSelf: boolean) => {
    if (!detail) return
    if (!confirm(isSelf ? 'Leave this household?' : 'Remove this member?')) return
    try {
      await removeHouseholdMember(detail.id, userId)
      onSuccess(isSelf ? 'Left household' : 'Member removed')
      onMutated()
      if (isSelf) {
        onClose()
      } else {
        reload()
      }
    } catch (e) {
      onError(extractError(e, 'Failed to remove'))
    }
  }

  const handleDeleteHousehold = async () => {
    if (!detail) return
    if (!confirm(`Delete household "${detail.name}"? Joint accounts will also be deleted.`)) return
    try {
      await deleteHousehold(detail.id)
      onSuccess('Household deleted')
      onMutated()
      onClose()
    } catch (e) {
      onError(extractError(e, 'Failed to delete'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {isCreate ? 'Create Household' : 'Manage Household'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground py-6">
            <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Name
              </label>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Smith Family"
                  disabled={!isCreate && !isAdmin}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      isCreate ? handleCreate() : handleRename()
                    }
                  }}
                />
                {isCreate ? (
                  <Button onClick={handleCreate} disabled={busy || !name.trim()} size="sm">
                    Create
                  </Button>
                ) : isAdmin && detail && name.trim() !== detail.name ? (
                  <Button onClick={handleRename} disabled={busy} size="sm">
                    Rename
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Member list (manage mode only) */}
            {detail && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Members ({detail.members.length})
                </p>
                <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {detail.members.map((m) => {
                    const isSelf = m.user_id === currentUserId
                    const canRemove = (isAdmin || isSelf) && !(detail.members.length === 1 && isSelf)
                    return (
                      <li key={m.user_id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-secondary/40">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground font-medium truncate">{m.username}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.role === 'admin' && (
                            <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                              <ShieldCheck className="w-3 h-3" /> admin
                            </span>
                          )}
                          {canRemove && (
                            <button
                              onClick={() => handleRemoveMember(m.user_id, isSelf)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title={isSelf ? 'Leave household' : 'Remove member'}
                            >
                              {isSelf ? <LogOut className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Invite (admin only) */}
            {detail && isAdmin && (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Invite by Email or Username
                </label>
                <div className="flex gap-2">
                  <Input
                    value={inviteValue}
                    onChange={(e) => setInviteValue(e.target.value)}
                    placeholder="alice@example.com or alice"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleInvite())}
                  />
                  <Button onClick={handleInvite} disabled={busy || !inviteValue.trim()} size="sm" className="gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> Invite
                  </Button>
                </div>
              </div>
            )}

            {/* Pending invitations (admin only) */}
            {detail && isAdmin && pending.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Pending invitations
                </p>
                <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {pending.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between px-3 py-2 bg-secondary/40">
                      <span className="text-sm text-foreground">user #{inv.invitee_user_id}</span>
                      <button
                        onClick={() => handleCancelInvite(inv.id)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Cancel
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Danger zone */}
            {detail && isAdmin && (
              <div className="pt-3 border-t border-border">
                <Button variant="destructive" size="sm" onClick={handleDeleteHousehold} className="gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete household
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function extractError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: string } } }
  return e.response?.data?.detail || fallback
}

export type { HouseholdSummary }
