import { useEffect, useMemo, useState } from 'react'
import {
  depositToSelfManaged,
  withdrawFromSelfManaged,
  changeSelfManagedRate,
  listRateHistory,
  type Account,
  type RateHistoryEntry,
} from '../services/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { formatCurrency } from '../lib/utils'
import { ArrowDownToLine, ArrowUpFromLine, Percent, X, History } from 'lucide-react'

type Mode = 'deposit' | 'withdraw' | 'rate'

interface SelfManagedActionsModalProps {
  account: Account
  initialMode: Mode
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function SelfManagedActionsModal({
  account,
  initialMode,
  onClose,
  onSuccess,
  onError,
}: SelfManagedActionsModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode)

  const [amount, setAmount] = useState('')
  const [asOfDate, setAsOfDate] = useState(todayIso())
  const [note, setNote] = useState('')

  const [newRatePct, setNewRatePct] = useState(
    account.interest_rate != null ? (Number(account.interest_rate) * 100).toString() : '',
  )
  const [effectiveDate, setEffectiveDate] = useState(todayIso())

  const [history, setHistory] = useState<RateHistoryEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Reset form when switching modes
    setError('')
    setAmount('')
    setNote('')
    setAsOfDate(todayIso())
  }, [mode])

  useEffect(() => {
    listRateHistory(account.id).then(setHistory).catch(() => setHistory([]))
  }, [account.id])

  const currentBalance = useMemo(
    () => parseFloat((account.current_balance as string) || '0') || 0,
    [account.current_balance],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'rate') {
        const rateDecimal = parseFloat(newRatePct) / 100
        if (!Number.isFinite(rateDecimal) || rateDecimal < 0) {
          setError('Rate must be 0 or higher')
          setSubmitting(false)
          return
        }
        await changeSelfManagedRate(account.id, {
          new_rate: rateDecimal,
          effective_date: effectiveDate,
        })
        onSuccess(`Rate updated to ${newRatePct}% effective ${effectiveDate}`)
        onClose()
        return
      }

      const amt = parseFloat(amount)
      if (!Number.isFinite(amt) || amt <= 0) {
        setError('Amount must be positive')
        setSubmitting(false)
        return
      }

      if (mode === 'deposit') {
        await depositToSelfManaged(account.id, {
          amount: amt,
          as_of_date: asOfDate,
          note: note || undefined,
        })
        onSuccess(`Deposited ${formatCurrency(amt)} to ${account.name}`)
      } else {
        await withdrawFromSelfManaged(account.id, {
          amount: amt,
          as_of_date: asOfDate,
          note: note || undefined,
        })
        onSuccess(`Withdrew ${formatCurrency(amt)} from ${account.name}`)
      }
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Action failed'
      setError(msg)
      onError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              {account.name}
            </p>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {mode === 'deposit' ? 'Deposit' : mode === 'withdraw' ? 'Withdraw' : 'Update Rate'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-5 pb-4 border-b border-border">
          <p className="text-xs text-muted-foreground">Current balance</p>
          <p className="font-mono text-xl font-semibold text-foreground">
            {formatCurrency(currentBalance)}
          </p>
          {account.interest_rate != null && (
            <p className="text-xs text-muted-foreground mt-1">
              APR{' '}
              <span className="font-mono text-foreground">
                {(Number(account.interest_rate) * 100).toFixed(2)}%
              </span>
            </p>
          )}
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-lg bg-secondary">
          <ModeTab
            active={mode === 'deposit'}
            onClick={() => setMode('deposit')}
            icon={<ArrowDownToLine className="w-3.5 h-3.5" />}
            label="Deposit"
          />
          <ModeTab
            active={mode === 'withdraw'}
            onClick={() => setMode('withdraw')}
            icon={<ArrowUpFromLine className="w-3.5 h-3.5" />}
            label="Withdraw"
          />
          <ModeTab
            active={mode === 'rate'}
            onClick={() => setMode('rate')}
            icon={<Percent className="w-3.5 h-3.5" />}
            label="Rate"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== 'rate' ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Amount <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Date
                </label>
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Note
                </label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional memo"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  New APR (%) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newRatePct}
                  onChange={(e) => setNewRatePct(e.target.value)}
                  placeholder="e.g., 4.50"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Effective Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Interest accrued before this date stays at the old rate.
                </p>
              </div>

              {history.length > 0 && (
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <History className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                      Rate History
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {[...history].reverse().map((h) => (
                      <li key={h.id} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-foreground">
                          {(Number(h.rate) * 100).toFixed(2)}%
                        </span>
                        <span className="text-muted-foreground font-mono">
                          from {h.effective_date}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting
                ? 'Saving…'
                : mode === 'deposit'
                  ? 'Deposit'
                  : mode === 'withdraw'
                    ? 'Withdraw'
                    : 'Update Rate'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ModeTabProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function ModeTab({ active, onClick, icon, label }: ModeTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
        (active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground')
      }
    >
      {icon}
      {label}
    </button>
  )
}
