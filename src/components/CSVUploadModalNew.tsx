import { useState, useEffect } from 'react'
import {
  Account,
  Category,
  getAccounts,
  getCategories,
  previewCSVImport,
  confirmCSVImport,
} from '../services/api'
import type { ImportPreviewResponse } from '../types/csv'
import TransactionPreviewTable from './csv-import/TransactionPreviewTable'
import { Button } from './ui/button'
import { CheckCircle2, Upload, X } from 'lucide-react'

interface CSVUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type Step = 'upload' | 'preview' | 'categorize' | 'confirm'
const STEP_LABELS = ['Upload', 'Preview', 'Categorize', 'Complete']
const STEP_NAMES: Step[] = ['upload', 'preview', 'categorize', 'confirm']

export default function CSVUploadModalNew({ isOpen, onClose, onSuccess }: CSVUploadModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null)
  const [categoryMappings, setCategoryMappings] = useState<Record<string, number | null>>({})
  const [typeOverrides, setTypeOverrides] = useState<Record<string, string>>({})
  const [fileContent, setFileContent] = useState<string>('')
  const [importResult, setImportResult] = useState<{
    total_rows: number; created: number; skipped: number; errors: number; categories_created: string[]
  } | null>(null)

  useEffect(() => {
    if (isOpen) { loadData(); resetState() }
  }, [isOpen])

  const loadData = async () => {
    try {
      const [accountList, categoryList] = await Promise.all([getAccounts(), getCategories()])
      setAccounts(accountList)
      setCategories(categoryList)
      if (accountList.length > 0 && !selectedAccountId) setSelectedAccountId(accountList[0].id)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data')
    }
  }

  const resetState = () => {
    setStep('upload'); setSelectedFile(null); setError('')
    setPreviewData(null); setCategoryMappings({}); setTypeOverrides({})
    setFileContent(''); setImportResult(null)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const nameLower = file.name.toLowerCase()
    if (!nameLower.endsWith('.csv') && !nameLower.endsWith('.pdf')) {
      setError('Please select a CSV or PDF file'); return
    }
    setSelectedFile(file); setError('')
    const reader = new FileReader()
    if (nameLower.endsWith('.csv')) {
      reader.onload = (ev) => { if (ev.target?.result) setFileContent(ev.target.result as string) }
      reader.readAsText(file)
    } else {
      reader.onload = (ev) => { if (ev.target?.result) setFileContent((ev.target.result as string).split(',')[1]) }
      reader.readAsDataURL(file)
    }
  }

  const handlePreview = async () => {
    if (!selectedFile || !selectedAccountId) { setError('Please select a file and account'); return }
    setIsLoading(true); setError('')
    try {
      const preview = await previewCSVImport(selectedFile, selectedAccountId)
      if (preview.error) { setError(preview.error); return }
      setPreviewData(preview)
      const mappings: Record<string, number | null> = {}
      preview.transactions.forEach((tx) => {
        if (tx.suggested_category) {
          const category = categories.find((c) => c.name.toLowerCase() === tx.suggested_category?.toLowerCase())
          mappings[tx.description] = category?.id || null
        } else {
          mappings[tx.description] = null
        }
      })
      setCategoryMappings(mappings)
      setStep('preview')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to preview CSV')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCategoryChange = (description: string, categoryId: number | null) =>
    setCategoryMappings((prev) => ({ ...prev, [description]: categoryId }))

  const handleTypeChange = (description: string, type: string) =>
    setTypeOverrides((prev) => ({ ...prev, [description]: type }))

  const handleBulkAssign = (pattern: string, categoryId: number | null) => {
    const newMappings = { ...categoryMappings }
    Object.keys(newMappings).forEach((desc) => {
      if (desc.toLowerCase().includes(pattern.toLowerCase())) newMappings[desc] = categoryId
    })
    setCategoryMappings(newMappings)
  }

  const handleDescriptionChange = (globalIndex: number, oldDescription: string, newDescription: string) => {
    if (!previewData) return
    const newTransactions = [...previewData.transactions]
    newTransactions[globalIndex] = { ...newTransactions[globalIndex], description: newDescription }
    setPreviewData({ ...previewData, transactions: newTransactions })
    setCategoryMappings((prev) => {
      const next = { ...prev }
      if (oldDescription in next) { next[newDescription] = next[oldDescription]; delete next[oldDescription] }
      return next
    })
    setTypeOverrides((prev) => {
      const next = { ...prev }
      if (oldDescription in next) { next[newDescription] = next[oldDescription]; delete next[oldDescription] }
      return next
    })
  }

  const handleRemoveTransactions = (indices: number[]) => {
    if (!previewData) return
    const newTransactions = previewData.transactions.filter((_, idx) => !indices.includes(idx))
    setPreviewData({ ...previewData, transactions: newTransactions, total_transactions: newTransactions.length })
    const newMappings = { ...categoryMappings }
    indices.forEach((idx) => { const t = previewData.transactions[idx]; if (t) delete newMappings[t.description] })
    setCategoryMappings(newMappings)
  }

  const handleConfirmImport = async () => {
    if (!previewData || !selectedAccountId) return
    setIsLoading(true); setError('')
    try {
      const result = await confirmCSVImport({
        file_content: fileContent,
        account_id: selectedAccountId,
        parser_name: previewData.parser_used,
        category_mappings: categoryMappings,
        type_overrides: typeOverrides,
        skip_duplicates: skipDuplicates,
        filename: selectedFile?.name,
      })
      setImportResult(result)
      setStep('confirm')
      setTimeout(() => onSuccess(), 2000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to import transactions')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => { resetState(); onClose() }

  if (!isOpen) return null

  const currentStepIndex = STEP_NAMES.indexOf(step)
  const isWide = step === 'preview' || step === 'categorize'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className={`bg-card border border-border rounded-2xl shadow-2xl flex flex-col animate-fade-up transition-all ${
          isWide ? 'w-full max-w-6xl max-h-[90vh]' : 'w-full max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Import Transactions</h3>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-1">
            {STEP_LABELS.map((label, index) => {
              const isActive = index === currentStepIndex
              const isCompleted = index < currentStepIndex
              return (
                <div key={label} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : isCompleted
                      ? 'bg-profit/10 text-profit'
                      : 'text-muted-foreground/50'
                  }`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-primary text-primary-foreground'
                      : isCompleted ? 'bg-profit text-background'
                      : 'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted ? '✓' : index + 1}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {index < STEP_LABELS.length - 1 && (
                    <div className={`w-4 h-px ${index < currentStepIndex ? 'bg-profit/40' : 'bg-border'}`} />
                  )}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className={`px-6 py-5 ${isWide ? 'overflow-y-auto flex-1' : ''}`}>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Account</label>
                {accounts.length === 0 ? (
                  <p className="text-sm text-destructive">No accounts found. Please create an account first.</p>
                ) : (
                  <select
                    value={selectedAccountId || ''}
                    onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                    className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.account_type})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">File</label>
                <label className={`flex flex-col items-center justify-center gap-3 w-full h-28 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                  selectedFile
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                }`}>
                  <input type="file" accept=".csv,.pdf" onChange={handleFileChange} className="sr-only" />
                  <Upload className={`w-6 h-6 ${selectedFile ? 'text-primary' : 'text-muted-foreground'}`} />
                  {selectedFile ? (
                    <span className="text-sm font-medium text-primary">{selectedFile.name}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Drop a CSV or PDF here, or click to browse</span>
                  )}
                </label>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground group-hover:text-foreground/80 transition-colors">Skip duplicate transactions</span>
              </label>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>Cancel</Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handlePreview}
                  disabled={isLoading || !selectedFile || !selectedAccountId}
                >
                  {isLoading ? 'Processing…' : 'Preview →'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 & 3: Preview & Categorize */}
          {(step === 'preview' || step === 'categorize') && previewData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary/50 text-sm">
                <span className="text-muted-foreground">Parser detected:</span>
                <span className="text-foreground font-medium">{previewData.parser_display_name}</span>
                <span className="text-muted-foreground/60 text-xs">({Math.round(previewData.confidence * 100)}% confidence)</span>
              </div>

              <TransactionPreviewTable
                transactions={previewData.transactions}
                categories={categories}
                categoryMappings={categoryMappings}
                typeOverrides={typeOverrides}
                onCategoryChange={handleCategoryChange}
                onTypeChange={handleTypeChange}
                onBulkAssign={handleBulkAssign}
                onRemoveTransactions={handleRemoveTransactions}
                onDescriptionChange={handleDescriptionChange}
              />

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setStep('upload')} disabled={isLoading}>
                  ← Back
                </Button>
                <Button type="button" size="sm" onClick={handleConfirmImport} disabled={isLoading}>
                  {isLoading ? 'Importing…' : 'Confirm Import'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'confirm' && importResult && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-14 h-14 rounded-full bg-profit/10 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-profit" />
                </div>
                <h4 className="font-display text-lg font-semibold text-foreground">Import Complete</h4>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
                  <div className="font-mono text-2xl font-semibold text-profit">{importResult.created}</div>
                  <div className="text-xs text-muted-foreground mt-1">Added</div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
                  <div className="font-mono text-2xl font-semibold text-muted-foreground">{importResult.skipped}</div>
                  <div className="text-xs text-muted-foreground mt-1">Skipped</div>
                </div>
                {importResult.errors > 0 && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
                    <div className="font-mono text-2xl font-semibold text-destructive">{importResult.errors}</div>
                    <div className="text-xs text-muted-foreground mt-1">Errors</div>
                  </div>
                )}
              </div>

              {importResult.categories_created.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">New categories created</p>
                  <div className="flex flex-wrap gap-2">
                    {importResult.categories_created.map((category, index) => (
                      <span key={index} className="px-3 py-1 rounded-full bg-secondary text-sm text-foreground border border-border">
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={handleClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
