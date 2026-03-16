import { useState, useEffect } from 'react'
import {
  getSplitwiseFriends,
  getSplitwiseGroups,
  createSplitwiseExpenses,
  type SplitwiseFriend,
  type SplitwiseGroup,
  type SplitwiseGroupMember,
  type Transaction
} from '../services/api'

interface SplitwiseSplitModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
  selectedTransactions: Transaction[]
}

type SplitType = 'equal' | 'exact' | 'percent'

interface Participant {
  id: number
  first_name: string
  last_name: string | null
  email: string | null
}

// ---------- localStorage helpers ----------
const LS_FAV_FRIENDS = 'sw_fav_friends'
const LS_FAV_GROUPS  = 'sw_fav_groups'

function loadFavs(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
  } catch { return new Set() }
}

function saveFavs(key: string, ids: Set<number>) {
  localStorage.setItem(key, JSON.stringify([...ids]))
}

function toggleFav(key: string, id: number, current: Set<number>): Set<number> {
  const next = new Set(current)
  if (next.has(id)) next.delete(id); else next.add(id)
  saveFavs(key, next)
  return next
}

// ---------- Star button ----------
function StarButton({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      title={active ? 'Remove from favourites' : 'Add to favourites'}
      className={`bg-transparent border-none cursor-pointer px-1 py-0.5 text-base leading-none flex-shrink-0 transition-colors duration-150 ${
        active ? 'text-amber-400' : 'text-muted-foreground hover:text-amber-400/60'
      }`}
    >
      {active ? '★' : '☆'}
    </button>
  )
}

// ---------- Accordion ----------
function AccordionSection({
  title, badge, isOpen, onToggle, children
}: {
  title: string; badge?: number; isOpen: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border border-border rounded-lg mb-2.5">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 border-none cursor-pointer text-sm font-semibold text-foreground transition-colors duration-150 ${
          isOpen ? 'bg-secondary/80 rounded-t-lg' : 'bg-secondary/40 rounded-lg'
        }`}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge !== undefined && badge > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-px text-[11px] font-bold">
              {badge}
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div className="border-t border-border">{children}</div>}
    </div>
  )
}

// ---------- Friend row (always individual selection) ----------
function ParticipantRow({
  participant, isSelected, isFavourite, splitType, customShare,
  onToggle, onShareChange, onFavToggle, disabled
}: {
  participant: Participant; isSelected: boolean; isFavourite: boolean
  splitType: SplitType; customShare: number | undefined
  onToggle: () => void; onShareChange: (value: string) => void
  onFavToggle: (e: React.MouseEvent) => void; disabled?: boolean
}) {
  const displayName = [participant.first_name, participant.last_name].filter(Boolean).join(' ')
  return (
    <div
      className={`px-4 py-2.5 border-b border-border flex items-center gap-2.5 transition-all duration-150 ${
        isSelected ? 'bg-primary/5' : 'bg-transparent'
      } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-secondary/30'}`}
      onClick={disabled ? undefined : onToggle}
    >
      <input
        type="checkbox" checked={isSelected} onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
        className={`flex-shrink-0 accent-primary ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground flex items-center gap-1">
          {isFavourite && <span className="text-amber-400 text-[13px]">★</span>}
          {displayName}
        </div>
        {participant.email && (
          <div className="text-xs text-muted-foreground mt-px">{participant.email}</div>
        )}
      </div>
      {splitType !== 'equal' && isSelected && (
        <input
          type="number" step="0.01" min="0"
          placeholder={splitType === 'percent' ? '% (0-100)' : 'Amount ($)'}
          value={customShare ?? ''}
          onChange={(e) => onShareChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-28 px-2 py-1.5 border border-border bg-secondary rounded-lg text-sm text-foreground flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-ring font-mono"
        />
      )}
      <StarButton active={isFavourite} onClick={onFavToggle} />
    </div>
  )
}

// ---------- Group member info row (equal split — no individual checkbox) ----------
function GroupMemberInfoRow({ member }: { member: SplitwiseGroupMember }) {
  const displayName = [member.first_name, member.last_name].filter(Boolean).join(' ')
  return (
    <div className="py-2 px-4 pl-11 border-b border-border/50 flex items-center gap-2 bg-secondary/20">
      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
      <div>
        <span className="text-[13px] font-medium text-foreground">{displayName}</span>
        {member.email && (
          <span className="text-xs text-muted-foreground ml-2">{member.email}</span>
        )}
      </div>
    </div>
  )
}

// ---------- Main modal ----------
export default function SplitwiseSplitModal({
  isOpen, onClose, onSuccess, onError, selectedTransactions
}: SplitwiseSplitModalProps) {
  const [loading, setLoading] = useState(false)
  const [friends, setFriends] = useState<SplitwiseFriend[]>([])
  const [groups, setGroups] = useState<SplitwiseGroup[]>([])

  // Editable expense name — defaults to shared category or descriptions
  const [expenseName, setExpenseName] = useState('')

  // Individual selection — used for friends always, and group members in exact/percent mode
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  // Group-level selection — only used in equal split mode
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set())

  const [splitType, setSplitType] = useState<SplitType>('equal')
  const [customShares, setCustomShares] = useState<Record<number, number>>({})
  const [fetchError, setFetchError] = useState('')
  const [friendsOpen, setFriendsOpen] = useState(true)
  const [groupsOpen, setGroupsOpen] = useState(true)
  const [favFriends, setFavFriends] = useState<Set<number>>(() => loadFavs(LS_FAV_FRIENDS))
  const [favGroups, setFavGroups]   = useState<Set<number>>(() => loadFavs(LS_FAV_GROUPS))

  // Derive default expense name from categories of selected transactions
  const deriveExpenseName = (): string => {
    const categories = [...new Set(
      selectedTransactions
        .map(t => t.category_name)
        .filter((c): c is string => c !== null)
    )]
    if (categories.length === 1) return categories[0]
    if (categories.length > 1) return categories.join(', ')
    return selectedTransactions.map(t => t.description).join(', ')
  }

  useEffect(() => {
    if (isOpen) {
      fetchData()
      setSelectedIds(new Set())
      setSelectedGroupIds(new Set())
      setCustomShares({})
      setFetchError('')
      setSplitType('equal')
      setExpenseName(deriveExpenseName())
    }
  }, [isOpen])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [friendsList, groupsList] = await Promise.all([
        getSplitwiseFriends(), getSplitwiseGroups()
      ])
      setFriends(friendsList)
      setGroups(groupsList)
    } catch (err: any) {
      setFetchError(err.response?.data?.detail || 'Failed to load Splitwise data')
    } finally {
      setLoading(false)
    }
  }

  const handleSplitTypeChange = (next: SplitType) => {
    setSplitType(next)
    // Group-level selection doesn't apply to exact/percent — clear it
    if (next !== 'equal') setSelectedGroupIds(new Set())
  }

  const toggleParticipant = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleGroup = (groupId: number) => {
    const next = new Set(selectedGroupIds)
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId)
    setSelectedGroupIds(next)
  }

  const handleShareChange = (id: number, value: string) => {
    setCustomShares({ ...customShares, [id]: parseFloat(value) || 0 })
  }

  const handleFavFriend = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setFavFriends(prev => toggleFav(LS_FAV_FRIENDS, id, prev))
  }

  const handleFavGroup = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setFavGroups(prev => toggleFav(LS_FAV_GROUPS, id, prev))
  }

  // Sorted lists — favourites first, then alphabetical
  const sortedFriends = [...friends].sort((a, b) => {
    const d = (favFriends.has(b.id) ? 1 : 0) - (favFriends.has(a.id) ? 1 : 0)
    return d !== 0 ? d : a.first_name.localeCompare(b.first_name)
  })

  const sortedGroups = [...groups].sort((a, b) => {
    const d = (favGroups.has(b.id) ? 1 : 0) - (favGroups.has(a.id) ? 1 : 0)
    return d !== 0 ? d : a.name.localeCompare(b.name)
  })

  // Build participant map for expense calculation
  const allParticipantsMap = new Map<number, Participant>()
  friends.forEach(f => allParticipantsMap.set(f.id, f))
  groups.forEach(g =>
    g.members.forEach(m => { if (!allParticipantsMap.has(m.id)) allParticipantsMap.set(m.id, m) })
  )

  // Resolve unique participant IDs combining individual + group selections
  const resolvedParticipantIds = (): Set<number> => {
    const ids = new Set(selectedIds)
    selectedGroupIds.forEach(gid => {
      const g = groups.find(g => g.id === gid)
      g?.members.forEach(m => ids.add(m.id))
    })
    return ids
  }

  const calculateParticipants = () => {
    const totalAmount = Math.abs(selectedTransactions.reduce((sum, t) => sum + t.amount, 0))
    const participantIds = resolvedParticipantIds()
    const numParticipants = participantIds.size + 1 // +1 for current user

    return [...participantIds].map(id => {
      if (splitType === 'equal') return { user_id: id, owed_share: totalAmount / numParticipants, paid_share: 0 }
      if (splitType === 'exact') return { user_id: id, owed_share: customShares[id] || 0, paid_share: 0 }
      return { user_id: id, owed_share: totalAmount * ((customShares[id] || 0) / 100), paid_share: 0 }
    })
  }

  // Derive a single group_id to attach to the expense, if unambiguous.
  const deriveGroupId = (): number | undefined => {
    if (splitType === 'equal') {
      // Group-level selection: only meaningful when exactly one group is chosen
      return selectedGroupIds.size === 1 ? [...selectedGroupIds][0] : undefined
    }
    // Individual member selection: use the group if every selected member
    // comes from the same single group (and none are pure friends)
    const involvedGroupIds = new Set<number>()
    for (const id of selectedIds) {
      const parentGroup = groups.find(g => g.members.some(m => m.id === id))
      if (!parentGroup) return undefined   // a pure friend is selected — no group context
      involvedGroupIds.add(parentGroup.id)
    }
    return involvedGroupIds.size === 1 ? [...involvedGroupIds][0] : undefined
  }

  const handleSubmit = async () => {
    const ids = resolvedParticipantIds()
    if (ids.size === 0) {
      onError('Please select at least one person or group')
      return
    }
    try {
      setLoading(true)
      const result = await createSplitwiseExpenses({
        transaction_ids: selectedTransactions.map(t => t.id),
        split_type: splitType,
        participants: calculateParticipants(),
        group_id: deriveGroupId(),
        description: expenseName || undefined
      })

      if (result.failed === 0) {
        onSuccess(`Split ${result.successful} transaction${result.successful !== 1 ? 's' : ''} as one expense on Splitwise`)
      } else {
        const firstError = result.results.find(r => r.status === 'error')?.error
        onError(firstError || 'Failed to create Splitwise expense')
      }
      onClose()
    } catch (err: any) {
      onError(err.response?.data?.detail || 'Failed to create Splitwise expenses')
      setLoading(false)
    }
  }

  // Badge counts
  const totalResolved = resolvedParticipantIds().size
  const selectedFriendCount = friends.filter(f => selectedIds.has(f.id)).length
  const groupsBadge = splitType === 'equal'
    ? selectedGroupIds.size
    : groups.reduce((acc, g) => acc + g.members.filter(m => selectedIds.has(m.id)).length, 0)

  // Net amount (raw sum) — negative means there's an expense to split
  const rawTotal = selectedTransactions.reduce((sum, t) => sum + t.amount, 0)
  const totalAmount = Math.abs(rawTotal)
  const netIsValid = rawTotal < 0

  const canSubmit = resolvedParticipantIds().size > 0 && netIsValid

  // True when a group is selected in equal-split mode — locks all other options
  const groupIsLocked = splitType === 'equal' && selectedGroupIds.size > 0

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-[600px] max-h-[85vh] overflow-auto p-6 shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold text-foreground mb-5">Split with Splitwise</h3>

        {/* Summary */}
        <div className="mb-5 p-4 bg-secondary/50 rounded-xl border border-border">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Selected Transactions:</span>{' '}
            <span className="font-mono">{selectedTransactions.length}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">Total Amount:</span>{' '}
            <span className={`font-mono font-semibold ${netIsValid ? 'text-destructive' : 'text-muted-foreground'}`}>
              {netIsValid ? `−$${totalAmount.toFixed(2)}` : `$${rawTotal.toFixed(2)}`}
            </span>
          </div>
          {!netIsValid && (
            <div className="mt-2 text-sm text-destructive">
              Net amount is zero or positive — nothing to split.
            </div>
          )}
        </div>

        {/* Expense Name */}
        <div className="mb-5 space-y-1.5">
          <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Expense Name
          </label>
          <input
            type="text"
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            placeholder="Enter expense name..."
            className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Split Type */}
        <div className="mb-5 space-y-1.5">
          <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Split Type
          </label>
          <select
            value={splitType}
            onChange={(e) => handleSplitTypeChange(e.target.value as SplitType)}
            className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="equal">Split Equally</option>
            <option value="exact">Custom Amount (exact per person)</option>
            <option value="percent">Percentage Split</option>
          </select>
        </div>

        {/* Participants header */}
        <div className="mb-2.5 text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Select Participants{totalResolved > 0 && (
            <span className="normal-case tracking-normal text-muted-foreground/70"> ({totalResolved} selected)</span>
          )}
        </div>

        {loading && friends.length === 0 && groups.length === 0 ? (
          <div className="flex items-center gap-3 text-muted-foreground py-5 justify-center">
            <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <>
            {/* ── Groups accordion ── */}
            <AccordionSection
              title="Groups"
              badge={groupsBadge}
              isOpen={groupsOpen}
              onToggle={() => setGroupsOpen(o => !o)}
            >
              {sortedGroups.length === 0 ? (
                <p className="px-4 py-4 text-muted-foreground text-sm m-0">
                  No Splitwise groups found.
                </p>
              ) : (
                sortedGroups.map(group => {
                  const isGroupSelected = selectedGroupIds.has(group.id)
                  const isFav = favGroups.has(group.id)
                  const isDisabled = groupIsLocked && !isGroupSelected
                  return (
                    <div key={group.id}>
                      {/* Group header row */}
                      <div
                        className={`px-4 py-2.5 border-b border-border flex items-center gap-2.5 transition-all duration-150 ${
                          isGroupSelected ? 'bg-primary/10' : (isFav ? 'bg-amber-400/5' : 'bg-secondary/30')
                        } ${isDisabled ? 'cursor-not-allowed opacity-40' : (splitType === 'equal' ? 'cursor-pointer hover:bg-secondary/50' : '')}`}
                        onClick={() => !isDisabled && splitType === 'equal' && toggleGroup(group.id)}
                      >
                        {splitType === 'equal' ? (
                          <input
                            type="checkbox"
                            checked={isGroupSelected}
                            onChange={() => toggleGroup(group.id)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isDisabled}
                            className={`flex-shrink-0 accent-primary ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          />
                        ) : (
                          // Decorative indent spacer for non-equal modes
                          <div className="w-4 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                            {isFav && <span className="text-amber-400">★</span>}
                            {group.name}
                          </span>
                          <span className="text-xs text-muted-foreground block">
                            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                            {splitType === 'equal' && isGroupSelected && (
                              <span className="text-primary ml-1.5 font-semibold">
                                · all included
                              </span>
                            )}
                          </span>
                        </div>
                        <StarButton active={isFav} onClick={(e) => handleFavGroup(e, group.id)} />
                      </div>

                      {/* Member rows */}
                      {splitType === 'equal' ? (
                        // Equal split: informational list (no individual checkboxes)
                        group.members.map((member: SplitwiseGroupMember) => (
                          <GroupMemberInfoRow key={member.id} member={member} />
                        ))
                      ) : (
                        // Exact / percent: individual selection with amount input
                        group.members.map((member: SplitwiseGroupMember) => (
                          <ParticipantRow
                            key={member.id}
                            participant={member}
                            isSelected={selectedIds.has(member.id)}
                            isFavourite={false}
                            splitType={splitType}
                            customShare={customShares[member.id]}
                            onToggle={() => toggleParticipant(member.id)}
                            onShareChange={(v) => handleShareChange(member.id, v)}
                            onFavToggle={(e) => e.stopPropagation()}
                          />
                        ))
                      )}
                    </div>
                  )
                })
              )}
            </AccordionSection>

            {/* ── Friends accordion ── */}
            <AccordionSection
              title="Friends"
              badge={selectedFriendCount}
              isOpen={friendsOpen}
              onToggle={() => setFriendsOpen(o => !o)}
            >
              {sortedFriends.length === 0 ? (
                <p className="px-4 py-4 text-muted-foreground text-sm m-0">
                  No Splitwise friends found.
                </p>
              ) : (
                sortedFriends.map(friend => (
                  <ParticipantRow
                    key={friend.id}
                    participant={friend}
                    isSelected={selectedIds.has(friend.id)}
                    isFavourite={favFriends.has(friend.id)}
                    splitType={splitType}
                    customShare={customShares[friend.id]}
                    onToggle={() => toggleParticipant(friend.id)}
                    onShareChange={(v) => handleShareChange(friend.id, v)}
                    onFavToggle={(e) => handleFavFriend(e, friend.id)}
                    disabled={groupIsLocked}
                  />
                ))
              )}
            </AccordionSection>
          </>
        )}

        {fetchError && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive mb-4">
            {fetchError}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose} disabled={loading}
            className={`px-5 py-2 bg-secondary text-foreground border border-border rounded-lg text-sm font-medium transition-colors duration-150 ${
              loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-secondary/80'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit} disabled={loading || !canSubmit}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors duration-150 ${
              loading || !canSubmit
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90'
            }`}
          >
            {loading ? 'Creating Expense...' : 'Split Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
