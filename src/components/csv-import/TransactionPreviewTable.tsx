import { useState } from 'react'
import type { PreviewTransaction } from '../../types/csv'
import type { Category } from '../../services/api'
import CategorySelector from './CategorySelector'

interface TransactionPreviewTableProps {
  transactions: PreviewTransaction[]
  categories: Category[]
  categoryMappings: Record<string, number | null>
  typeOverrides: Record<string, string>
  onCategoryChange: (description: string, categoryId: number | null) => void
  onTypeChange: (description: string, type: string) => void
  onBulkAssign?: (pattern: string, categoryId: number | null) => void
  onRemoveTransactions?: (indices: number[]) => void
  onDescriptionChange: (globalIndex: number, oldDescription: string, newDescription: string) => void
}

export default function TransactionPreviewTable({
  transactions,
  categories,
  categoryMappings,
  typeOverrides,
  onCategoryChange,
  onTypeChange,
  onBulkAssign: _onBulkAssign,
  onRemoveTransactions,
  onDescriptionChange,
}: TransactionPreviewTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const itemsPerPage = 50

  const totalPages = Math.ceil(transactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentTransactions = transactions.slice(startIndex, startIndex + itemsPerPage)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const indices = new Set<number>()
      currentTransactions.forEach((_, idx) => indices.add(startIndex + idx))
      setSelectedIndices(indices)
    } else {
      setSelectedIndices(new Set())
    }
  }

  const handleSelectOne = (globalIndex: number, checked: boolean) => {
    const newSelected = new Set(selectedIndices)
    if (checked) newSelected.add(globalIndex)
    else newSelected.delete(globalIndex)
    setSelectedIndices(newSelected)
  }

  const handleBulkAssignSelected = () => {
    if (selectedIndices.size === 0) return
    const selectedDescriptions = Array.from(selectedIndices).map(idx => transactions[idx].description)
    const categoryId = categoryMappings[selectedDescriptions[0]] || null
    if (confirm(`Bulk assign category to ${selectedIndices.size} selected transaction(s)?`)) {
      selectedDescriptions.forEach((desc) => onCategoryChange(desc, categoryId))
      setSelectedIndices(new Set())
    }
  }

  const handleRemoveSelected = () => {
    if (selectedIndices.size === 0 || !onRemoveTransactions) return
    if (confirm(`Remove ${selectedIndices.size} selected transaction(s) from import?`)) {
      onRemoveTransactions(Array.from(selectedIndices).sort((a, b) => b - a))
      setSelectedIndices(new Set())
    }
  }

  const duplicateCount = transactions.filter((t) => t.is_duplicate).length
  const transferCount = transactions.filter((t) => t.is_transfer_candidate).length
  const linkedTransferCount = transactions.filter((t) => t.transfer_target_account).length

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-secondary/50 text-sm">
        <span className="text-foreground font-medium">{transactions.length} transactions</span>
        {duplicateCount > 0 && <span className="text-yellow-400">{duplicateCount} duplicates</span>}
        {transferCount > 0 && <span className="text-blue-400">{transferCount} transfers</span>}
      </div>

      {linkedTransferCount > 0 && (
        <div className="px-4 py-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-sm text-blue-400">
          <strong>Auto-linking:</strong> {linkedTransferCount} transfer(s) will create matching transactions on target accounts.
        </div>
      )}

      {selectedIndices.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm text-foreground">{selectedIndices.size} selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBulkAssignSelected}
              className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Assign Category
            </button>
            {onRemoveTransactions && (
              <button
                type="button"
                onClick={handleRemoveSelected}
                className="px-3 py-1.5 text-xs rounded-md bg-destructive/80 text-white hover:bg-destructive transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60">
              <th className="px-3 py-2.5 text-left w-9">
                <input
                  type="checkbox"
                  className="rounded border-border accent-primary"
                  checked={currentTransactions.length > 0 && currentTransactions.every((_, idx) => selectedIndices.has(startIndex + idx))}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground whitespace-nowrap">Date</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Description</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground whitespace-nowrap">Amount</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Type</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground min-w-[180px]">Category</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {currentTransactions.map((transaction, index) => {
              const globalIndex = startIndex + index
              const categoryId = categoryMappings[transaction.description] || null
              const currentType = typeOverrides[transaction.description] || transaction.type
              const isDuplicate = transaction.is_duplicate
              const isTransfer = transaction.is_transfer_candidate

              return (
                <tr
                  key={globalIndex}
                  className={`transition-colors ${isDuplicate ? 'bg-yellow-500/5' : 'hover:bg-secondary/30'}`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="rounded border-border accent-primary"
                      checked={selectedIndices.has(globalIndex)}
                      onChange={(e) => handleSelectOne(globalIndex, e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-3 py-2.5 max-w-[240px]">
                    <input
                      type="text"
                      defaultValue={transaction.description}
                      disabled={isDuplicate}
                      onBlur={(e) => {
                        const newVal = e.target.value.trim()
                        if (newVal && newVal !== transaction.description) {
                          onDescriptionChange(globalIndex, transaction.description, newVal)
                        } else {
                          e.target.value = transaction.description
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') { e.currentTarget.value = transaction.description; e.currentTarget.blur() }
                      }}
                      className={`w-full text-sm bg-transparent border border-transparent rounded px-1 py-0.5 text-foreground focus:outline-none focus:border-primary focus:bg-secondary transition-colors ${
                        isDuplicate ? 'cursor-not-allowed opacity-60' : 'hover:border-border cursor-text'
                      }`}
                    />
                    {transaction.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 px-1">{transaction.notes}</p>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono text-sm font-medium whitespace-nowrap ${
                    currentType === 'expense' || currentType === 'transfer' ? 'text-destructive' : 'text-profit'
                  }`}>
                    {currentType === 'expense' || currentType === 'transfer' ? '−' : '+'}${transaction.amount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={currentType}
                      onChange={(e) => onTypeChange(transaction.description, e.target.value)}
                      disabled={isDuplicate}
                      className={`text-xs rounded-md border border-border px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring transition-colors ${
                        isDuplicate ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-secondary text-foreground cursor-pointer'
                      }`}
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                      <option value="transfer">Transfer</option>
                      <option value="card_payment">Card Payment</option>
                      <option value="refund">Refund</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <CategorySelector
                      categories={categories}
                      selectedCategoryId={categoryId}
                      suggestedCategoryName={transaction.suggested_category}
                      onChange={(newCategoryId) => onCategoryChange(transaction.description, newCategoryId)}
                      disabled={isDuplicate}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {isDuplicate && (
                      <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 whitespace-nowrap">
                        Duplicate
                      </span>
                    )}
                    {!isDuplicate && currentType === 'transfer' && (
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
                          Transfer
                        </span>
                        {transaction.transfer_target_account && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap" title={`Will create matching transaction on ${transaction.transfer_target_account}`}>
                            → {transaction.transfer_target_account}
                          </span>
                        )}
                      </div>
                    )}
                    {!isDuplicate && currentType === 'refund' && (
                      <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-profit/10 text-profit border border-profit/20 whitespace-nowrap">
                        Refund
                      </span>
                    )}
                    {!isDuplicate && isTransfer && currentType !== 'transfer' && (
                      <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border whitespace-nowrap">
                        Auto: Transfer
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
