import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { listHouseholds, type HouseholdSummary } from '../services/api'

interface HouseholdScopePickerProps {
  value: number | null
  onChange: (householdId: number | null) => void
  className?: string
}

/**
 * Scope picker — toggles a page between "Individual" (caller's accounts) and a
 * specific household (combined across all members + joint accounts). Local state
 * per page; not stored globally.
 */
export default function HouseholdScopePicker({ value, onChange, className }: HouseholdScopePickerProps) {
  const [households, setHouseholds] = useState<HouseholdSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listHouseholds()
      .then(setHouseholds)
      .catch(() => setHouseholds([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading || households.length === 0) {
    // Hide the picker entirely if the user has no households — nothing to switch to.
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Users className="w-3.5 h-3.5 text-muted-foreground" />
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="flex h-9 rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Individual</option>
        {households.map((h) => (
          <option key={h.id} value={h.id}>
            Household: {h.name}
          </option>
        ))}
      </select>
    </div>
  )
}
