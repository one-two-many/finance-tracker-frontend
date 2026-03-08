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
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '2px 4px', fontSize: '16px', lineHeight: 1,
        color: active ? '#f5a623' : '#ccc', flexShrink: 0, transition: 'color 0.15s'
      }}
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
    <div style={{ border: '1px solid #ddd', borderRadius: '6px', marginBottom: '10px' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '12px 16px',
          backgroundColor: isOpen ? '#f0f4ff' : '#f8f9fa',
          border: 'none', borderRadius: isOpen ? '6px 6px 0 0' : '6px',
          cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#333',
          transition: 'background-color 0.15s'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {title}
          {badge !== undefined && badge > 0 && (
            <span style={{
              backgroundColor: '#5C4EE5', color: 'white',
              borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700
            }}>
              {badge}
            </span>
          )}
        </span>
        <span style={{ fontSize: '12px', color: '#666' }}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div style={{ borderTop: '1px solid #ddd' }}>{children}</div>}
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
      style={{
        padding: '10px 16px', borderBottom: '1px solid #eee',
        display: 'flex', alignItems: 'center', gap: '10px',
        backgroundColor: isSelected ? '#f0f8ff' : 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 0.15s'
      }}
      onClick={disabled ? undefined : onToggle}
    >
      <input
        type="checkbox" checked={isSelected} onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isFavourite && <span style={{ color: '#f5a623', fontSize: '13px' }}>★</span>}
          {displayName}
        </div>
        {participant.email && (
          <div style={{ fontSize: '12px', color: '#888', marginTop: '1px' }}>{participant.email}</div>
        )}
      </div>
      {splitType !== 'equal' && isSelected && (
        <input
          type="number" step="0.01" min="0"
          placeholder={splitType === 'percent' ? '% (0-100)' : 'Amount ($)'}
          value={customShare ?? ''}
          onChange={(e) => onShareChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '110px', padding: '6px 8px', border: '1px solid #ddd',
            borderRadius: '4px', fontSize: '13px', flexShrink: 0
          }}
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
    <div style={{
      padding: '8px 16px 8px 44px',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex', alignItems: 'center', gap: '8px',
      backgroundColor: '#fafeff'
    }}>
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%',
        backgroundColor: '#5C4EE5', flexShrink: 0
      }} />
      <div>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>{displayName}</span>
        {member.email && (
          <span style={{ fontSize: '12px', color: '#aaa', marginLeft: '8px' }}>{member.email}</span>
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

  useEffect(() => {
    if (isOpen) {
      fetchData()
      setSelectedIds(new Set())
      setSelectedGroupIds(new Set())
      setCustomShares({})
      setFetchError('')
      setSplitType('equal')
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
    const totalAmount = selectedTransactions.reduce((sum, t) => sum + t.amount, 0)
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
        group_id: deriveGroupId()
      })

      if (result.failed === 0) {
        onSuccess(`Split ${result.successful} expense${result.successful !== 1 ? 's' : ''} on Splitwise`)
      } else if (result.successful > 0) {
        onError(`${result.successful} split, ${result.failed} failed — check Splitwise`)
      } else {
        const firstError = result.results.find(r => r.status === 'error')?.error
        onError(firstError || 'All expenses failed to split on Splitwise')
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

  const canSubmit = resolvedParticipantIds().size > 0

  // True when a group is selected in equal-split mode — locks all other options
  const groupIsLocked = splitType === 'equal' && selectedGroupIds.size > 0

  if (!isOpen) return null

  const totalAmount = selectedTransactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '8px',
          width: '90%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto', padding: '24px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Split with Splitwise</h2>

        {/* Summary */}
        <div style={{
          marginBottom: '20px', padding: '15px',
          backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #dee2e6'
        }}>
          <div><strong>Selected Transactions:</strong> {selectedTransactions.length}</div>
          <div><strong>Total Amount:</strong> ${totalAmount.toFixed(2)}</div>
        </div>

        {/* Split Type */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
            Split Type
          </label>
          <select
            value={splitType}
            onChange={(e) => handleSplitTypeChange(e.target.value as SplitType)}
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
          >
            <option value="equal">Split Equally</option>
            <option value="exact">Custom Amount (exact per person)</option>
            <option value="percent">Percentage Split</option>
          </select>
        </div>

        {/* Participants header */}
        <div style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '14px' }}>
          Select Participants{totalResolved > 0 && (
            <span style={{ fontWeight: 400, color: '#666' }}> ({totalResolved} selected)</span>
          )}
        </div>

        {loading && friends.length === 0 && groups.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</p>
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
                <p style={{ padding: '16px', color: '#888', margin: 0, fontSize: '14px' }}>
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
                        style={{
                          padding: '10px 16px',
                          backgroundColor: isGroupSelected ? '#eef2ff' : (isFav ? '#fffbec' : '#f5f5f5'),
                          borderBottom: '1px solid #eee',
                          display: 'flex', alignItems: 'center', gap: '10px',
                          cursor: isDisabled ? 'not-allowed' : (splitType === 'equal' ? 'pointer' : 'default'),
                          opacity: isDisabled ? 0.4 : 1,
                          transition: 'opacity 0.15s'
                        }}
                        onClick={() => !isDisabled && splitType === 'equal' && toggleGroup(group.id)}
                      >
                        {splitType === 'equal' ? (
                          <input
                            type="checkbox"
                            checked={isGroupSelected}
                            onChange={() => toggleGroup(group.id)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isDisabled}
                            style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                          />
                        ) : (
                          // Decorative indent spacer for non-equal modes
                          <div style={{ width: '16px', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#444', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {isFav && <span style={{ color: '#f5a623' }}>★</span>}
                            {group.name}
                          </span>
                          <span style={{ fontSize: '12px', color: '#888' }}>
                            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                            {splitType === 'equal' && isGroupSelected && (
                              <span style={{ color: '#5C4EE5', marginLeft: '6px', fontWeight: 600 }}>
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
                <p style={{ padding: '16px', color: '#888', margin: 0, fontSize: '14px' }}>
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
          <div style={{
            backgroundColor: '#f8d7da', color: '#721c24', padding: '12px',
            borderRadius: '4px', marginBottom: '15px', border: '1px solid #f5c6cb', fontSize: '14px'
          }}>
            {fetchError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            onClick={onClose} disabled={loading}
            style={{
              padding: '10px 20px', backgroundColor: '#6c757d', color: 'white',
              border: 'none', borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit} disabled={loading || !canSubmit}
            style={{
              padding: '10px 20px',
              backgroundColor: loading || !canSubmit ? '#adb5bd' : '#5C4EE5',
              color: 'white', border: 'none', borderRadius: '4px',
              cursor: loading || !canSubmit ? 'not-allowed' : 'pointer', fontSize: '14px'
            }}
          >
            {loading ? 'Creating Expenses...' : 'Split Expenses'}
          </button>
        </div>
      </div>
    </div>
  )
}
