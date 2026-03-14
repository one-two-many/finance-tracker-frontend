import { useState, useEffect, useCallback } from 'react'
import {
  getTransactions,
  getAccounts,
  getCategories,
  deleteTransaction,
  updateTransactionCategory,
  getSplitwiseCredentials,
  type Transaction,
  type Account,
  type Category,
  type TransactionFilters,
} from '../services/api'
import SplitwiseSplitModal from '../components/SplitwiseSplitModal'
import { useToast, ToastContainer } from '../components/Toast'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { formatCurrency, formatDate } from '../lib/utils'
import {
  Trash2,
  Split,
  X,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Hash,
  Filter,
} from 'lucide-react'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth)
  const [selectedAccount, setSelectedAccount] = useState<number | undefined>(undefined)
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined)
  const [selectedType, setSelectedType] = useState<'income' | 'expense' | 'transfer' | undefined>(undefined)

  // Delete states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)

  // Selection
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set())

  // Splitwise
  const [splitwiseModalOpen, setSplitwiseModalOpen] = useState(false)
  const [splitwiseConnected, setSplitwiseConnected] = useState(false)

  // Inline category editing
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [savingCategory, setSavingCategory] = useState<number | null>(null)

  const { toasts, showToast, dismissToast } = useToast()

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: TransactionFilters = {}
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-')
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
        const endDate = new Date(parseInt(year), parseInt(month), 0)
        filters.start_date = startDate.toISOString().split('T')[0]
        filters.end_date = endDate.toISOString().split('T')[0]
      }
      if (selectedAccount) filters.account_id = selectedAccount
      if (selectedCategory) filters.category_id = selectedCategory
      if (selectedType) filters.transaction_type = selectedType
      const data = await getTransactions(filters)
      setTransactions(data)
    } catch {
      setError('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedAccount, selectedCategory, selectedType])

  useEffect(() => {
    Promise.all([getAccounts(), getCategories()]).then(([accts, cats]) => {
      setAccounts(accts)
      setCategories(cats)
    })
    getSplitwiseCredentials().then((s) => setSplitwiseConnected(s.is_active)).catch(() => {})
  }, [])

  useEffect(() => {
    loadTransactions()
    setSelectedTransactions(new Set())
  }, [loadTransactions])

  const handleCategoryChange = async (txnId: number, newCategoryId: number | null) => {
    setSavingCategory(txnId)
    try {
      const updated = await updateTransactionCategory(txnId, newCategoryId)
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txnId
            ? { ...t, category_id: updated.category_id, category_name: updated.category_name, category_color: updated.category_color }
            : t
        )
      )
      setEditingCategoryId(null)
      showToast('Category updated', 'success')
    } catch {
      showToast('Failed to update category', 'error')
    } finally {
      setSavingCategory(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return
    setDeleting(true)
    try {
      await deleteTransaction(transactionToDelete.id)
      setDeleteModalOpen(false)
      setTransactionToDelete(null)
      loadTransactions()
    } catch {
      showToast('Failed to delete transaction', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await Promise.all(Array.from(selectedTransactions).map((id) => deleteTransaction(id)))
      setBulkDeleteModalOpen(false)
      setSelectedTransactions(new Set())
      loadTransactions()
    } catch {
      showToast('Failed to delete transactions', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedTransactions(checked ? new Set(transactions.map((t) => t.id)) : new Set())
  }

  const handleSelectTransaction = (id: number, checked: boolean) => {
    const s = new Set(selectedTransactions)
    if (checked) s.add(id); else s.delete(id)
    setSelectedTransactions(s)
  }

  const clearFilters = () => {
    setSelectedMonth(currentMonth)
    setSelectedAccount(undefined)
    setSelectedCategory(undefined)
    setSelectedType(undefined)
  }

  const totals = transactions.reduce(
    (acc, txn) => {
      if (txn.transaction_type === 'income') acc.income += txn.amount
      else if (txn.transaction_type === 'expense') acc.expense += txn.amount
      return acc
    },
    { income: 0, expense: 0 }
  )
  const netAmount = totals.income - totals.expense
  const isAllSelected = transactions.length > 0 && selectedTransactions.size === transactions.length

  const typeBadgeVariant = (type: string) => {
    if (type === 'income') return 'profit'
    if (type === 'expense') return 'loss'
    return 'transfer'
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Finance</p>
        <h1 className="font-display text-2xl font-bold text-foreground">Transactions</h1>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up animate-fade-up-1">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[hsl(158_100%_42%)]" />
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Income</p>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xl font-semibold text-profit">{formatCurrency(totals.income)}</span>
              <TrendingUp className="w-4 h-4 text-profit" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-destructive" />
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Expenses</p>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xl font-semibold text-destructive">{formatCurrency(totals.expense)}</span>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className={`absolute top-0 left-0 right-0 h-[2px] ${netAmount >= 0 ? 'bg-[hsl(158_100%_42%)]' : 'bg-destructive'}`} />
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Net</p>
            <div className="flex items-center justify-between">
              <span className={`font-mono text-xl font-semibold ${netAmount >= 0 ? 'text-profit' : 'text-destructive'}`}>
                {netAmount >= 0 ? '+' : ''}{formatCurrency(netAmount)}
              </span>
              <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary/50" />
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Count</p>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xl font-semibold text-foreground">{transactions.length}</span>
              <Hash className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="animate-fade-up animate-fade-up-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Month</label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Account</label>
              <select
                value={selectedAccount ?? ''}
                onChange={(e) => setSelectedAccount(e.target.value ? parseInt(e.target.value) : undefined)}
                className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Accounts</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Category</label>
              <select
                value={selectedCategory ?? ''}
                onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : undefined)}
                className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Type</label>
              <select
                value={selectedType ?? ''}
                onChange={(e) => setSelectedType((e.target.value as 'income' | 'expense' | 'transfer') || undefined)}
                className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1.5">
              <X className="w-3.5 h-3.5" /> Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card className="animate-fade-up animate-fade-up-3">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>
            {selectedTransactions.size > 0
              ? `${selectedTransactions.size} selected`
              : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedTransactions.size > 0 && splitwiseConnected && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSplitwiseModalOpen(true)}
                className="gap-1.5 text-xs border-violet-500/30 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
              >
                <Split className="w-3.5 h-3.5" />
                Split ({selectedTransactions.size})
              </Button>
            )}
            {selectedTransactions.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteModalOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedTransactions.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
              <span className="text-sm">Loading transactions…</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <ArrowLeftRight className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No transactions found for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pl-5 pr-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">Amount</th>
                    <th className="pl-3 pr-5 py-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className={`txn-row transition-colors ${selectedTransactions.has(txn.id) ? 'bg-primary/5' : ''}`}
                    >
                      <td className="pl-5 pr-3 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(txn.id)}
                          onChange={(e) => handleSelectTransaction(txn.id, e.target.checked)}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground font-mono whitespace-nowrap">
                        {formatDate(txn.transaction_date)}
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground truncate">{txn.description}</span>
                          {txn.splitwise_split && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                              ⚡ Splitwise
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                        {txn.account_name}
                      </td>
                      <td className="px-4 py-3.5">
                        {editingCategoryId === txn.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              autoFocus
                              defaultValue={txn.category_id ?? ''}
                              disabled={savingCategory === txn.id}
                              onChange={(e) => handleCategoryChange(txn.id, e.target.value ? parseInt(e.target.value) : null)}
                              onBlur={() => setEditingCategoryId(null)}
                              className="h-7 rounded-md border border-primary/40 bg-secondary px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">— None —</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}{cat.is_global ? ' (Global)' : ''}</option>
                              ))}
                            </select>
                            {savingCategory === txn.id && (
                              <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCategoryId(txn.id)}
                            className="group flex items-center"
                            title="Click to change category"
                          >
                            {txn.category_name ? (
                              <span
                                className="px-2 py-0.5 rounded-md text-xs font-medium border"
                                style={{
                                  backgroundColor: `${txn.category_color}18`,
                                  color: txn.category_color || '#888',
                                  borderColor: `${txn.category_color}30`,
                                }}
                              >
                                {txn.category_name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 group-hover:text-muted-foreground italic transition-colors">
                                + Add category
                              </span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant={typeBadgeVariant(txn.transaction_type) as 'profit' | 'loss' | 'transfer'}>
                          {txn.transaction_type}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3.5 text-right font-mono text-sm font-semibold ${
                        txn.transaction_type === 'income' ? 'text-profit' : txn.transaction_type === 'transfer' ? 'text-blue-400' : 'text-destructive'
                      }`}>
                        {txn.transaction_type === 'income' ? '+' : '−'}
                        {formatCurrency(Math.abs(txn.amount))}
                      </td>
                      <td className="pl-3 pr-5 py-3.5 text-center">
                        <button
                          onClick={() => { setTransactionToDelete(txn); setDeleteModalOpen(true) }}
                          className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && transactionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-up">
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Delete transaction?</h3>
            <p className="text-sm text-muted-foreground mb-5">This action cannot be undone.</p>
            <div className="p-4 rounded-xl bg-secondary/50 border border-border mb-5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Description</span>
                <span className="text-sm font-medium text-foreground">{transactionToDelete.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Date</span>
                <span className="text-sm font-mono text-foreground">{formatDate(transactionToDelete.transaction_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className={`text-sm font-mono font-semibold ${transactionToDelete.transaction_type === 'income' ? 'text-profit' : 'text-destructive'}`}>
                  {formatCurrency(transactionToDelete.amount)}
                </span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteConfirm} disabled={deleting} className="gap-1.5">
                {deleting ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Deleting…</> : <><Trash2 className="w-3.5 h-3.5" />Delete</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-up">
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Delete {selectedTransactions.size} transactions?</h3>
            <p className="text-sm text-muted-foreground mb-5">This will permanently delete all selected transactions.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setBulkDeleteModalOpen(false)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDeleteConfirm} disabled={deleting} className="gap-1.5">
                {deleting
                  ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Deleting…</>
                  : <><Trash2 className="w-3.5 h-3.5" />Delete {selectedTransactions.size}</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      <SplitwiseSplitModal
        isOpen={splitwiseModalOpen}
        onClose={() => setSplitwiseModalOpen(false)}
        onSuccess={(message) => {
          setSplitwiseModalOpen(false)
          setSelectedTransactions(new Set())
          loadTransactions()
          showToast(message, 'success')
        }}
        onError={(message) => showToast(message, 'error')}
        selectedTransactions={transactions.filter((t) => selectedTransactions.has(t.id))}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
