import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import {
  createAccount,
  listParsers,
  listHouseholds,
  type AccountCreate,
  type HouseholdSummary,
  type Parser,
} from '../services/api'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface CreateAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateAccountModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateAccountModalProps) {
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<string>('checking')
  const [initialBalance, setInitialBalance] = useState('')
  const [defaultParser, setDefaultParser] = useState<string>('')
  const [parsers, setParsers] = useState<Parser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // CD + HYSA new state
  const [interestRatePct, setInterestRatePct] = useState('') // displayed as %, e.g. "4.50"
  const [termMonths, setTermMonths] = useState('')
  const [inceptionDate, setInceptionDate] = useState('')
  const [maturityDate, setMaturityDate] = useState('')
  const [maturityOverridden, setMaturityOverridden] = useState(false)
  const [isSelfManaged, setIsSelfManaged] = useState(false)

  // Household / joint-account state
  const [ownership, setOwnership] = useState<'personal' | 'joint'>('personal')
  const [households, setHouseholds] = useState<HouseholdSummary[]>([])
  const [householdId, setHouseholdId] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      loadParsers()
      listHouseholds()
        .then((data) => {
          setHouseholds(data)
          if (data.length > 0 && !householdId) setHouseholdId(String(data[0].id))
        })
        .catch(() => setHouseholds([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Auto-fill maturity date when inception + term are set and user hasn't manually overridden
  useEffect(() => {
    if (inceptionDate && termMonths && !maturityOverridden) {
      const d = new Date(inceptionDate)
      d.setMonth(d.getMonth() + parseInt(termMonths, 10))
      setMaturityDate(d.toISOString().slice(0, 10))
    }
  }, [inceptionDate, termMonths, maturityOverridden])

  const loadParsers = async () => {
    try {
      const data = await listParsers()
      setParsers(data)
    } catch (err) {
      console.error('Failed to load parsers:', err)
    }
  }

  const accountTypes = [
    { value: 'checking', label: 'Checking Account' },
    { value: 'savings', label: 'Savings Account' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'investment', label: 'Investment Account' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' },
    { value: 'high_yield_savings', label: 'High Yield Savings (HYSA)' },
    { value: 'cd', label: 'Certificate of Deposit (CD)' },
  ]

  const isCD = accountType === 'cd'
  const isHYSA = accountType === 'high_yield_savings'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Account name is required'); return }

    // CD-specific validation
    if (isCD) {
      if (!initialBalance || parseFloat(initialBalance) <= 0) {
        setError('CDs require a positive initial balance'); return
      }
      if (!interestRatePct || parseFloat(interestRatePct) < 0) {
        setError('Interest rate must be 0 or higher'); return
      }
      if (!termMonths && !maturityDate) {
        setError('CDs require either Term (months) or a Maturity Date'); return
      }
    }

    setIsLoading(true)
    try {
      const accountData: AccountCreate = {
        name: name.trim(),
        account_type: accountType,
        currency: 'USD',
        initial_balance: initialBalance ? parseFloat(initialBalance) : 0,
        default_parser: defaultParser || undefined,
        interest_rate: interestRatePct ? parseFloat(interestRatePct) / 100 : undefined,
        term_months: termMonths ? parseInt(termMonths, 10) : undefined,
        inception_date: inceptionDate || undefined,
        maturity_date: maturityDate || undefined,
        is_self_managed: isSelfManaged,
        household_id: ownership === 'joint' && householdId ? parseInt(householdId, 10) : undefined,
      }
      if (ownership === 'joint' && !householdId) {
        setError('Choose a household for the joint account')
        setIsLoading(false)
        return
      }
      await createAccount(accountData)
      handleClose()
      onSuccess()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create account',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setAccountType('checking')
    setInitialBalance('')
    setDefaultParser('')
    setError('')
    setInterestRatePct('')
    setTermMonths('')
    setInceptionDate('')
    setMaturityDate('')
    setMaturityOverridden(false)
    setIsSelfManaged(false)
    setOwnership('personal')
    setHouseholdId(households.length > 0 ? String(households[0].id) : '')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold text-foreground mb-5">Create Account</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Account Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chase Freedom, BOA Checking"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Account Type <span className="text-destructive">*</span>
            </label>
            <select
              value={accountType}
              onChange={(e) => {
                setAccountType(e.target.value)
                // Reset CD/HYSA fields when switching types
                setInterestRatePct('')
                setTermMonths('')
                setInceptionDate('')
                setMaturityDate('')
                setMaturityOverridden(false)
              }}
              className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {accountTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Ownership
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOwnership('personal')}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                  ownership === 'personal'
                    ? 'bg-primary/10 border-primary text-primary font-medium'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() => setOwnership('joint')}
                disabled={households.length === 0}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-center gap-1.5 ${
                  ownership === 'joint'
                    ? 'bg-primary/10 border-primary text-primary font-medium'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground'
                }`}
                title={households.length === 0 ? 'Create a household first in Settings' : 'Shared with the selected household'}
              >
                <Users className="w-3.5 h-3.5" /> Joint
              </button>
            </div>
            {ownership === 'joint' && households.length > 0 && (
              <select
                value={householdId}
                onChange={(e) => setHouseholdId(e.target.value)}
                className="mt-2 flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {households.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}
            {ownership === 'joint' && households.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Create a household in Settings first.</p>
            )}
          </div>

          {/* CD-specific fields */}
          {isCD && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">CD Details</p>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Interest Rate (% APR) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(e.target.value)}
                  placeholder="e.g., 4.50"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Term (months)
                </label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={termMonths}
                  onChange={(e) => {
                    setTermMonths(e.target.value)
                    setMaturityOverridden(false)
                  }}
                  placeholder="e.g., 12"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Inception Date
                </label>
                <Input
                  type="date"
                  value={inceptionDate}
                  onChange={(e) => {
                    setInceptionDate(e.target.value)
                    setMaturityOverridden(false)
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Maturity Date
                  {!maturityOverridden && termMonths && inceptionDate && (
                    <span className="ml-2 text-xs text-muted-foreground normal-case tracking-normal">(auto-computed)</span>
                  )}
                </label>
                <Input
                  type="date"
                  value={maturityDate}
                  onChange={(e) => {
                    setMaturityDate(e.target.value)
                    setMaturityOverridden(true)
                  }}
                />
              </div>
            </div>
          )}

          {/* HYSA-specific fields */}
          {isHYSA && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">HYSA Details</p>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Interest Rate (% APR)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(e.target.value)}
                  placeholder="e.g., 4.50"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {isSelfManaged ? 'Used to auto-accrue monthly interest' : 'Reference only — used for display'}
                </p>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={isSelfManaged}
                  onChange={(e) => setIsSelfManaged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border bg-secondary accent-[hsl(158,100%,42%)]"
                />
                <span className="text-sm text-foreground">
                  Self-managed
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    No CSV statements for this account. I'll enter deposits/withdrawals manually; the
                    app will auto-add monthly interest.
                  </span>
                </span>
              </label>

              {isSelfManaged && (
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Inception Date
                  </label>
                  <Input
                    type="date"
                    value={inceptionDate}
                    onChange={(e) => setInceptionDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Interest accrual starts the month after this date. Defaults to today if left empty.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Self-managed block for non-HYSA, non-CD types (Savings, Other, etc.) */}
          {!isHYSA && !isCD && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isSelfManaged}
                onChange={(e) => setIsSelfManaged(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border bg-secondary accent-[hsl(158,100%,42%)]"
              />
              <span className="text-sm text-foreground">
                Self-managed
                <span className="block text-xs text-muted-foreground mt-0.5">
                  No CSV statements for this account — enter balance changes manually. Add an interest
                  rate below to auto-accrue monthly interest.
                </span>
              </span>
            </label>
          )}

          {isSelfManaged && !isHYSA && !isCD && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Interest Rate (% APR)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(e.target.value)}
                  placeholder="e.g., 4.50 — leave blank if none"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Inception Date
                </label>
                <Input
                  type="date"
                  value={inceptionDate}
                  onChange={(e) => setInceptionDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Default CSV Parser
            </label>
            <select
              value={defaultParser}
              onChange={(e) => setDefaultParser(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Auto-detect</option>
              {parsers.map((parser) => (
                <option key={parser.name} value={parser.name}>{parser.display_name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Link this account to a CSV format for easier imports</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Initial Balance
            </label>
            <Input
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {isCD
                ? 'Required for CDs — enter the principal amount'
                : 'Leave empty or enter 0 if starting fresh'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Creating…' : 'Create Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
