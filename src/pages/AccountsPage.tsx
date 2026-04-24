import { useState, useEffect } from 'react'
import {
  getAccounts,
  updateAccount,
  deleteAccount,
  listParsers,
  type Account,
  type AccountUpdate,
  type Parser,
} from '../services/api'
import CreateAccountModal from '../components/CreateAccountModal'
import SelfManagedActionsModal from '../components/SelfManagedActionsModal'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useToast, ToastContainer } from '../components/Toast'
import { formatCurrency } from '../lib/utils'
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  X,
  Check,
  ArrowDownToLine,
  ArrowUpFromLine,
  Percent,
  Sparkles,
} from 'lucide-react'

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'high_yield_savings', label: 'High Yield Savings (HYSA)' },
  { value: 'cd', label: 'Certificate of Deposit (CD)' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'investment', label: 'Investment' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

// ISO date 'YYYY-MM-DD' → "Apr 15, 2026". Parse locally (avoid UTC shift).
const formatAsOfDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const TYPE_COLORS: Record<string, string> = {
  checking: 'text-blue-400',
  savings: 'text-profit',
  high_yield_savings: 'text-profit',
  cd: 'text-primary',
  credit_card: 'text-violet-400',
  investment: 'text-yellow-400',
  cash: 'text-muted-foreground',
  other: 'text-muted-foreground',
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [parsers, setParsers] = useState<Parser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editFormData, setEditFormData] = useState<AccountUpdate>({})
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null)

  // CD + HYSA edit state (interest rate shown as %, stored as decimal)
  const [editInterestRatePct, setEditInterestRatePct] = useState('')
  const [editTermMonths, setEditTermMonths] = useState('')
  const [editInceptionDate, setEditInceptionDate] = useState('')
  const [editMaturityDate, setEditMaturityDate] = useState('')
  const [editMaturityOverridden, setEditMaturityOverridden] = useState(true)
  const [editIsSelfManaged, setEditIsSelfManaged] = useState(false)

  // Self-managed actions modal
  const [smAction, setSmAction] = useState<{ account: Account; mode: 'deposit' | 'withdraw' | 'rate' } | null>(null)
  const { toasts, showToast, dismissToast } = useToast()

  const editType = editFormData.account_type
  const isEditCD = editType === 'cd'
  const isEditHYSA = editType === 'high_yield_savings'

  // Auto-fill maturity date when inception + term change and user hasn't manually overridden
  useEffect(() => {
    if (isEditCD && editInceptionDate && editTermMonths && !editMaturityOverridden) {
      const d = new Date(editInceptionDate)
      d.setMonth(d.getMonth() + parseInt(editTermMonths, 10))
      setEditMaturityDate(d.toISOString().slice(0, 10))
    }
  }, [editInceptionDate, editTermMonths, editMaturityOverridden, isEditCD])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [accountsData, parsersData] = await Promise.all([getAccounts(), listParsers()])
      setAccounts(accountsData)
      setParsers(parsersData)
    } catch {
      setError('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const closeEdit = () => {
    setEditingAccount(null)
    setEditInterestRatePct('')
    setEditTermMonths('')
    setEditInceptionDate('')
    setEditMaturityDate('')
    setEditMaturityOverridden(true)
    setEditIsSelfManaged(false)
  }

  const handleSaveEdit = async () => {
    if (!editingAccount) return

    const payload: AccountUpdate = { ...editFormData }

    if (isEditCD) {
      if (!editInterestRatePct || parseFloat(editInterestRatePct) < 0) {
        alert('Interest rate must be 0 or higher')
        return
      }
      if (!editTermMonths && !editMaturityDate) {
        alert('CDs require either Term (months) or a Maturity Date')
        return
      }
      payload.interest_rate = parseFloat(editInterestRatePct) / 100
      payload.term_months = editTermMonths ? parseInt(editTermMonths, 10) : undefined
      payload.inception_date = editInceptionDate || undefined
      payload.maturity_date = editMaturityDate || undefined
    } else if (isEditHYSA) {
      payload.interest_rate = editInterestRatePct ? parseFloat(editInterestRatePct) / 100 : undefined
      payload.inception_date = editInceptionDate || undefined
    } else if (editIsSelfManaged) {
      payload.interest_rate = editInterestRatePct ? parseFloat(editInterestRatePct) / 100 : undefined
      payload.inception_date = editInceptionDate || undefined
    }

    payload.is_self_managed = editIsSelfManaged

    try {
      await updateAccount(editingAccount.id, payload)
      await loadData()
      closeEdit()
    } catch {
      alert('Failed to update account')
    }
  }

  const handleDelete = async (account: Account) => {
    try {
      await deleteAccount(account.id)
      setDeleteConfirm(null)
      await loadData()
    } catch {
      alert('Failed to delete account')
    }
  }

  const getParserDisplayName = (name?: string) => {
    if (!name) return 'Auto-detect'
    return parsers.find((p) => p.name === name)?.display_name || name
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-up">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Finance</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Accounts</h1>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Account
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Accounts table */}
      <Card className="animate-fade-up animate-fade-up-1">
        <CardHeader className="pb-3">
          <CardTitle>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No accounts yet</p>
              <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Create first account
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Account</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Parser</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Balance</th>
                    <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {accounts.map((account) => (
                    <tr key={account.id} className="txn-row">
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{account.name}</p>
                          {account.account_number_last4 && (
                            <p className="text-xs text-muted-foreground mt-0.5">···{account.account_number_last4}</p>
                          )}
                          {account.bank_name && (
                            <p className="text-xs text-muted-foreground">{account.bank_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium capitalize ${TYPE_COLORS[account.account_type] || 'text-muted-foreground'}`}>
                            {ACCOUNT_TYPES.find((t) => t.value === account.account_type)?.label || account.account_type}
                          </span>
                          {account.is_self_managed && (
                            <span
                              title="Self-managed: balance entered manually, interest auto-accrued"
                              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              Self-managed
                              {account.interest_rate != null && (
                                <span className="font-mono">
                                  {(Number(account.interest_rate) * 100).toFixed(2)}%
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-muted-foreground">{getParserDisplayName(account.default_parser)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {formatCurrency(parseFloat(account.current_balance as string) || 0)}
                          </span>
                          {account.balance_as_of_date && (
                            <span className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                              as of {formatAsOfDate(account.balance_as_of_date)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {account.is_self_managed && (
                            <>
                              <button
                                onClick={() => setSmAction({ account, mode: 'deposit' })}
                                title="Deposit"
                                className="p-1.5 rounded-md text-muted-foreground/60 hover:text-profit hover:bg-primary/10 transition-colors"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSmAction({ account, mode: 'withdraw' })}
                                title="Withdraw"
                                className="p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <ArrowUpFromLine className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSmAction({ account, mode: 'rate' })}
                                title="Update rate"
                                className="p-1.5 rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
                              >
                                <Percent className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-px h-4 bg-border mx-1" />
                            </>
                          )}
                          <button
                            onClick={() => {
                              setEditingAccount(account)
                              setEditFormData({
                                name: account.name,
                                account_type: account.account_type,
                                default_parser: account.default_parser || '',
                                bank_name: account.bank_name || '',
                                account_number_last4: account.account_number_last4 || '',
                              })
                              setEditInterestRatePct(
                                account.interest_rate != null
                                  ? (Number(account.interest_rate) * 100).toString()
                                  : '',
                              )
                              setEditTermMonths(account.term_months != null ? String(account.term_months) : '')
                              setEditInceptionDate(account.inception_date ?? '')
                              setEditMaturityDate(account.maturity_date ?? '')
                              // Existing accounts: treat maturity as user-set so we don't auto-recompute on open
                              setEditMaturityOverridden(true)
                              setEditIsSelfManaged(!!account.is_self_managed)
                            }}
                            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(account)}
                            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeEdit}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-foreground mb-5">Edit Account</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Name</label>
                <Input
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Type</label>
                <select
                  value={editFormData.account_type || ''}
                  onChange={(e) => {
                    const next = e.target.value
                    setEditFormData({ ...editFormData, account_type: next })
                    if (next !== 'cd' && next !== 'high_yield_savings') {
                      setEditInterestRatePct('')
                      setEditTermMonths('')
                      setEditInceptionDate('')
                      setEditMaturityDate('')
                      setEditMaturityOverridden(true)
                    }
                  }}
                  className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {isEditCD && (
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
                      value={editInterestRatePct}
                      onChange={(e) => setEditInterestRatePct(e.target.value)}
                      placeholder="e.g., 4.50"
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Term (months)</label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={editTermMonths}
                      onChange={(e) => {
                        setEditTermMonths(e.target.value)
                        setEditMaturityOverridden(false)
                      }}
                      placeholder="e.g., 12"
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Inception Date</label>
                    <Input
                      type="date"
                      value={editInceptionDate}
                      onChange={(e) => {
                        setEditInceptionDate(e.target.value)
                        setEditMaturityOverridden(false)
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                      Maturity Date
                      {!editMaturityOverridden && editTermMonths && editInceptionDate && (
                        <span className="ml-2 text-xs text-muted-foreground normal-case tracking-normal">(auto-computed)</span>
                      )}
                    </label>
                    <Input
                      type="date"
                      value={editMaturityDate}
                      onChange={(e) => {
                        setEditMaturityDate(e.target.value)
                        setEditMaturityOverridden(true)
                      }}
                    />
                  </div>
                </div>
              )}

              {isEditHYSA && (
                <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">HYSA Details</p>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Interest Rate (% APR)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editInterestRatePct}
                      onChange={(e) => setEditInterestRatePct(e.target.value)}
                      placeholder="e.g., 4.50"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      {editIsSelfManaged
                        ? 'Used to auto-accrue monthly interest. Change via the Rate button on the account row.'
                        : 'Reference only — used for display'}
                    </p>
                  </div>
                </div>
              )}

              {!isEditCD && (
                <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editIsSelfManaged}
                      onChange={(e) => setEditIsSelfManaged(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border bg-secondary accent-[hsl(158,100%,42%)]"
                    />
                    <span className="text-sm text-foreground">
                      Self-managed
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        No CSV statements — enter deposits/withdrawals manually; the app auto-accrues
                        monthly interest.
                      </span>
                    </span>
                  </label>

                  {editIsSelfManaged && !isEditHYSA && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                          Interest Rate (% APR)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editInterestRatePct}
                          onChange={(e) => setEditInterestRatePct(e.target.value)}
                          placeholder="e.g., 4.50 — leave blank if none"
                          className="font-mono"
                        />
                      </div>
                    </>
                  )}

                  {editIsSelfManaged && (
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                        Inception Date
                      </label>
                      <Input
                        type="date"
                        value={editInceptionDate}
                        onChange={(e) => setEditInceptionDate(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Accrual starts the month after this date.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Default CSV Parser</label>
                <select
                  value={editFormData.default_parser || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, default_parser: e.target.value })}
                  className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Auto-detect</option>
                  {parsers.map((p) => <option key={p.name} value={p.name}>{p.display_name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Bank Name</label>
                <Input
                  value={editFormData.bank_name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, bank_name: e.target.value })}
                  placeholder="e.g., Chase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Last 4 Digits</label>
                <Input
                  maxLength={4}
                  value={editFormData.account_number_last4 || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, account_number_last4: e.target.value })}
                  placeholder="1234"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button variant="outline" size="sm" onClick={closeEdit}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} className="gap-1.5">
                <Check className="w-3.5 h-3.5" /> Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-up">
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Delete account?</h3>
            <p className="text-sm text-muted-foreground mb-1">
              This will permanently delete <strong className="text-foreground">"{deleteConfirm.name}"</strong> and all its transactions.
            </p>
            <p className="text-xs text-destructive mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(deleteConfirm)} className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <CreateAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => { setIsCreateModalOpen(false); loadData() }}
      />

      {smAction && (
        <SelfManagedActionsModal
          account={smAction.account}
          initialMode={smAction.mode}
          onClose={() => setSmAction(null)}
          onSuccess={(msg) => {
            showToast(msg, 'success')
            loadData()
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
