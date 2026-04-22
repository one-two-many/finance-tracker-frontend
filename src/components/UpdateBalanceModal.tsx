import { useState } from 'react'
import { updateAccountBalance, type Account } from '../services/api'
import { useToast } from './Toast'
import { ToastContainer } from './Toast'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface UpdateBalanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  account: Account
}

export default function UpdateBalanceModal({
  isOpen,
  onClose,
  onSuccess,
  account,
}: UpdateBalanceModalProps) {
  const today = new Date().toISOString().slice(0, 10)

  const [balance, setBalance] = useState(
    () => String(parseFloat(String(account.current_balance)) || 0),
  )
  const [interestEarned, setInterestEarned] = useState('')
  const [asOfDate, setAsOfDate] = useState(today)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState('')

  const { toasts, showToast, dismissToast } = useToast()

  // Warn when re-posting today with interest
  const showResubmitWarning =
    asOfDate === today && interestEarned !== '' && parseFloat(interestEarned) > 0

  const handleSubmit = async () => {
    setValidationError('')

    const parsedBalance = parseFloat(balance)
    if (balance === '' || isNaN(parsedBalance)) {
      setValidationError('Balance is required and must be a valid number')
      return
    }

    if (interestEarned !== '') {
      const parsedInterest = parseFloat(interestEarned)
      if (isNaN(parsedInterest) || parsedInterest < 0) {
        setValidationError('Interest earned must be 0 or greater')
        return
      }
    }

    if (!asOfDate) {
      setValidationError('As of date is required')
      return
    }

    setSubmitting(true)
    try {
      const result = await updateAccountBalance(account.id, {
        balance: parsedBalance,
        interest_earned: interestEarned ? parseFloat(interestEarned) : undefined,
        as_of_date: asOfDate,
        note: note || undefined,
      })
      const msg = result.interest_transaction
        ? 'Balance updated · Interest logged as income'
        : 'Balance updated'
      showToast(msg, 'success')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail
      showToast(detail || 'Failed to update balance', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setBalance(String(parseFloat(String(account.current_balance)) || 0))
    setInterestEarned('')
    setAsOfDate(today)
    setNote('')
    setValidationError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div
          className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">
            Update Balance
          </h3>
          <p className="text-xs text-muted-foreground mb-5">{account.name}</p>

          <div className="space-y-4">
            {/* Balance */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Current Balance <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
            </div>

            {/* Interest Earned */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Interest Earned (optional)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={interestEarned}
                onChange={(e) => setInterestEarned(e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Creates an Interest income transaction if &gt; 0
              </p>
            </div>

            {/* Resubmit warning */}
            {showResubmitWarning && (
              <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-xs text-amber-400">
                Re-submitting for today will create an additional Interest transaction.
              </div>
            )}

            {/* As of Date */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                As of Date <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g., April statement"
                className="flex w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Validation error */}
            {validationError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {validationError}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Save Balance'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
