import { useState, useEffect, useCallback } from 'react'
import {
  getTransactions,
  getAccounts,
  getCategories,
  deleteTransaction,
  updateTransactionCategory,
  updateTransactionType,
  getSplitwiseCredentials,
  mergeTransactions,
  type Transaction,
  type Account,
  type Category,
  type TransactionFilters,
} from '../services/api'
import SplitwiseSplitModal from '../components/SplitwiseSplitModal'
import { useToast, ToastContainer } from '../components/Toast'
import { useAuth } from '../lib/auth'
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
  GitMerge,
} from 'lucide-react'
import MultiSelectFilter from '../components/MultiSelectFilter'
import MonthMultiSelect from '../components/MonthMultiSelect'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth)
  const [monthMode, setMonthMode] = useState<'single' | 'multi'>('single')
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([])
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])

  const [selectedType, setSelectedType] = useState<'income' | 'expense' | 'transfer' | 'card_payment' | 'refund' | undefined>(undefined)

  // Delete states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)

  // Selection
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set())

  // Merge states
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [merging, setMerging] = useState(false)
  const [mergePrimaryId, setMergePrimaryId] = useState<number | null>(null)

  // Splitwise
  const [splitwiseModalOpen, setSplitwiseModalOpen] = useState(false)
  const [splitwiseConnected, setSplitwiseConnected] = useState(false)

  // Inline category editing
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [savingCategory, setSavingCategory] = useState<number | null>(null)

  // Inline type editing
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null)
  const [savingType, setSavingType] = useState<number | null>(null)

  const { toasts, showToast, dismissToast } = useToast()
  const { user: authUser } = useAuth()

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: TransactionFilters = {}
      if (monthMode === 'single' && selectedMonth) {
        const [year, month] = selectedMonth.split('-')
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
        const endDate = new Date(parseInt(year), parseInt(month), 0)
        filters.start_date = startDate.toISOString().split('T')[0]
        filters.end_date = endDate.toISOString().split('T')[0]
      } else if (monthMode === 'multi' && selectedMonths.length > 0) {
        const sorted = [...selectedMonths].sort()
        const [startYear, startMonth] = sorted[0].split('-').map(Number)
        const [endYear, endMonth] = sorted[sorted.length - 1].split('-').map(Number)
        filters.start_date = new Date(startYear, startMonth - 1, 1).toISOString().split('T')[0]
        filters.end_date = new Date(endYear, endMonth, 0).toISOString().split('T')[0]
      }
      if (selectedAccounts.length > 0) filters.account_ids = selectedAccounts
      if (selectedCategories.length > 0) filters.category_ids = selectedCategories
      if (selectedType) filters.transaction_type = selectedType
      const data = await getTransactions(filters)
      setTransactions(data)
    } catch {
      setError('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [monthMode, selectedMonth, selectedMonths, selectedAccounts, selectedCategories, selectedType])

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

  const handleTypeChange = async (txnId: number, newType: 'income' | 'expense' | 'transfer' | 'card_payment' | 'refund') => {
    setSavingType(txnId)
    try {
      const updated = await updateTransactionType(txnId, newType)
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txnId ? { ...t, transaction_type: updated.transaction_type } : t
        )
      )
      setEditingTypeId(null)
      showToast('Transaction type updated', 'success')
    } catch {
      showToast('Failed to update transaction type', 'error')
    } finally {
      setSavingType(null)
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

  const handleMergeConfirm = async () => {
    setMerging(true)
    try {
      const ids = Array.from(selectedTransactions)
      await mergeTransactions(ids, mergePrimaryId ?? undefined)
      setMergeModalOpen(false)
      setMergePrimaryId(null)
      setSelectedTransactions(new Set())
      loadTransactions()
      showToast('Transactions merged successfully', 'success')
    } catch {
      showToast('Failed to merge transactions', 'error')
    } finally {
      setMerging(false)
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
    setMonthMode('single')
    setSelectedMonth(currentMonth)
    setSelectedMonths([])
    setSelectedAccounts([])
    setSelectedCategories([])
    setSelectedType(undefined)
  }

  const isPositiveType = (type: string) => type === 'income' || type === 'card_payment' || type === 'refund'

  const totals = transactions.reduce(
    (acc, txn) => {
      if (isPositiveType(txn.transaction_type)) acc.income += txn.amount
      else if (txn.transaction_type === 'expense') acc.expense += txn.amount
      return acc
    },
    { income: 0, expense: 0 }
  )
  const netAmount = totals.income - totals.expense
  const isAllSelected = transactions.length > 0 && selectedTransactions.size === transactions.length

  const mergePreview = mergeModalOpen && selectedTransactions.size >= 2
    ? (() => {
        const list = transactions
          .filter((t) => selectedTransactions.has(t.id))
          .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())
        const net = list.reduce(
          (sum, txn) => sum + (isPositiveType(txn.transaction_type) ? txn.amount : -txn.amount),
          0
        )
        return { list, net }
      })()
    : null

  const typeBadgeVariant = (type: string) => {
    if (type === 'income') return 'profit'
    if (type === 'expense') return 'loss'
    if (type === 'card_payment') return 'card_payment'
    if (type === 'refund') return 'refund'
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
      <Card className="animate-fade-up animate-fade-up-2 relative z-10 overflow-visible">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Month</label>
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMonthMode('single')}
                    className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                      monthMode === 'single' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthMode('multi')}
                    className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                      monthMode === 'multi' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Multi
                  </button>
                </div>
              </div>
              {monthMode === 'single' ? (
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-sm"
                />
              ) : (
                <MonthMultiSelect
                  selected={selectedMonths}
                  onChange={setSelectedMonths}
                  placeholder="Select months"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Account</label>
              <MultiSelectFilter
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                selected={selectedAccounts}
                onChange={setSelectedAccounts}
                placeholder="All Accounts"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Category</label>
              <MultiSelectFilter
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                selected={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="All Categories"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Type</label>
              <select
                value={selectedType ?? ''}
                onChange={(e) => setSelectedType((e.target.value as 'income' | 'expense' | 'transfer' | 'card_payment' | 'refund') || undefined)}
                className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
                <option value="card_payment">Card Payment</option>
                <option value="refund">Refund</option>
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
            {selectedTransactions.size >= 2 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMergeModalOpen(true)}
                className="gap-1.5 text-xs border-sky-500/30 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
              >
                <GitMerge className="w-3.5 h-3.5" />
                Merge ({selectedTransactions.size})
              </Button>
            )}
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
                        <div className="flex items-center gap-2">
                          <span>{txn.account_name}</span>
                          {txn.account_household_id != null && authUser && txn.user_id != null && txn.user_id !== authUser.id && (
                            <span
                              className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                              title={`Imported by user #${txn.user_id}`}
                            >
                              shared
                            </span>
                          )}
                        </div>
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
                        {editingTypeId === txn.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <select
                              autoFocus
                              defaultValue={txn.transaction_type}
                              disabled={savingType === txn.id}
                              onChange={(e) => handleTypeChange(txn.id, e.target.value as 'income' | 'expense' | 'transfer' | 'card_payment' | 'refund')}
                              onBlur={() => setEditingTypeId(null)}
                              className="h-7 rounded-md border border-primary/40 bg-secondary px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="income">income</option>
                              <option value="expense">expense</option>
                              <option value="transfer">transfer</option>
                              <option value="card_payment">card payment</option>
                              <option value="refund">refund</option>
                            </select>
                            {savingType === txn.id && (
                              <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingTypeId(txn.id)}
                            title="Click to change type"
                          >
                            <Badge variant={typeBadgeVariant(txn.transaction_type) as 'profit' | 'loss' | 'transfer' | 'card_payment' | 'refund'}>
                              {txn.transaction_type}
                            </Badge>
                          </button>
                        )}
                      </td>
                      <td className={`px-4 py-3.5 text-right font-mono text-sm font-semibold ${
                        isPositiveType(txn.transaction_type) ? 'text-profit' : txn.transaction_type === 'transfer' ? 'text-blue-400' : 'text-destructive'
                      }`}>
                        {isPositiveType(txn.transaction_type) ? '+' : '−'}
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
                <span className={`text-sm font-mono font-semibold ${isPositiveType(transactionToDelete.transaction_type) ? 'text-profit' : 'text-destructive'}`}>
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

      {/* Merge Confirmation Modal */}
      {mergeModalOpen && mergePreview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setMergeModalOpen(false); setMergePrimaryId(null) }}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Merge {mergePreview.list.length} transactions?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click a transaction to choose which one to keep. All others will be deleted.
            </p>

            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {mergePreview.list.map((txn) => {
                const isKept = txn.id === (mergePrimaryId ?? mergePreview.list[0].id)
                return (
                  <button
                    key={txn.id}
                    type="button"
                    onClick={() => setMergePrimaryId(txn.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      isKept
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-secondary/30 hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-foreground truncate">{txn.description}</span>
                        {isKept && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            Kept
                          </span>
                        )}
                      </div>
                      <span className={`shrink-0 ml-3 font-mono text-sm font-semibold ${isPositiveType(txn.transaction_type) ? 'text-profit' : 'text-destructive'}`}>
                        {isPositiveType(txn.transaction_type) ? '+' : '−'}{formatCurrency(txn.amount)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{formatDate(txn.transaction_date)}</span>
                  </button>
                )
              })}
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border mb-5">
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Net Result</span>
                <span className={`font-mono text-lg font-semibold ${mergePreview.net >= 0 ? 'text-profit' : 'text-destructive'}`}>
                  {mergePreview.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(mergePreview.net))}
                </span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setMergeModalOpen(false); setMergePrimaryId(null) }} disabled={merging}>Cancel</Button>
              <Button size="sm" onClick={handleMergeConfirm} disabled={merging} className="gap-1.5">
                {merging
                  ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Merging…</>
                  : <><GitMerge className="w-3.5 h-3.5" />Merge</>}
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
