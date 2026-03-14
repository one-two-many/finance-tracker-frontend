import { useState, useEffect } from 'react'
import {
  getCategoryRules,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  type CategoryRule,
  type CategoryRuleCreate,
  type Category,
  type CategoryCreate,
} from '../services/api'
import { useAuth } from '../lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Plus, Pencil, Trash2, X, Check, Tag, Globe } from 'lucide-react'

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#84cc16',
]
const ICON_OPTIONS = ['💰', '🍔', '🏠', '🚗', '✈️', '🎮', '👕', '💊', '📱', '⚡', '🎬', '🛒', '🏋️', '📚', '🎵']

const PATTERN_TYPE_STYLES: Record<string, string> = {
  keyword: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  exact: 'bg-profit/10 text-profit border-profit/20',
  regex: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}

export default function CategoryRulesPage() {
  const { user } = useAuth()
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null)
  const [ruleFormData, setRuleFormData] = useState<CategoryRuleCreate>({
    category_id: 0,
    pattern: '',
    pattern_type: 'keyword',
    priority: 0,
  })

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryFormData, setCategoryFormData] = useState<CategoryCreate>({
    name: '',
    color: '#6366f1',
    icon: '💰',
    is_global: false,
  })

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [rulesData, categoriesData] = await Promise.all([getCategoryRules(), getCategories()])
      setRules(rulesData)
      setCategories(categoriesData)
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const resetRuleForm = () => {
    setRuleFormData({ category_id: 0, pattern: '', pattern_type: 'keyword', priority: 0 })
    setEditingRule(null)
  }

  const handleSaveRule = async () => {
    if (!ruleFormData.category_id || !ruleFormData.pattern) { alert('Fill all required fields'); return }
    try {
      if (editingRule) {
        await updateCategoryRule(editingRule.id, { pattern: ruleFormData.pattern, pattern_type: ruleFormData.pattern_type, priority: ruleFormData.priority })
      } else {
        await createCategoryRule(ruleFormData)
      }
      await loadData()
      setIsRuleModalOpen(false)
      resetRuleForm()
    } catch { alert('Failed to save rule') }
  }

  const handleToggleActive = async (rule: CategoryRule) => {
    try {
      await updateCategoryRule(rule.id, { is_active: !rule.is_active })
      await loadData()
    } catch { alert('Failed to update rule') }
  }

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Delete this rule?')) return
    try { await deleteCategoryRule(id); await loadData() } catch { alert('Failed to delete rule') }
  }

  const resetCategoryForm = () => {
    setCategoryFormData({ name: '', color: '#6366f1', icon: '💰', is_global: false })
    setEditingCategory(null)
  }

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) { alert('Enter a category name'); return }
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryFormData)
      } else {
        await createCategory(categoryFormData)
      }
      await loadData()
      setIsCategoryModalOpen(false)
      resetCategoryForm()
    } catch { alert('Failed to save category') }
  }

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Delete this category and all its rules?')) return
    try { await deleteCategory(id); await loadData() } catch { alert('Failed to delete category') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Automation</p>
        <h1 className="font-display text-2xl font-bold text-foreground">Categories & Rules</h1>
      </div>

      {error && <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>}

      {/* Categories */}
      <Card className="animate-fade-up animate-fade-up-1">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>{categories.length} categories</CardTitle>
          <Button size="sm" onClick={() => { resetCategoryForm(); setIsCategoryModalOpen(true) }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Category
          </Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <Tag className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No categories yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border group"
                >
                  <span className="text-xl shrink-0">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{cat.name}</p>
                      {cat.is_global && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 shrink-0">
                          <Globe className="w-2.5 h-2.5" /> Global
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cat.color }} />
                      <span className="text-[10px] font-mono text-muted-foreground">{cat.color}</span>
                    </div>
                  </div>
                  {cat.user_id === user?.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditingCategory(cat); setCategoryFormData({ name: cat.name, color: cat.color, icon: cat.icon }); setIsCategoryModalOpen(true) }}
                        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card className="animate-fade-up animate-fade-up-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>{rules.length} auto-categorization rules</CardTitle>
          <Button size="sm" onClick={() => { resetRuleForm(); setIsRuleModalOpen(true) }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Rule
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="flex flex-col items-center py-14 gap-3">
              <p className="text-sm text-muted-foreground">No rules yet — add one to auto-categorize imports</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Category</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Pattern</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Type</th>
                    <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Priority</th>
                    <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.map((rule) => (
                    <tr key={rule.id} className={`txn-row ${!rule.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium text-foreground">{rule.category_name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="text-sm font-mono text-muted-foreground">{rule.pattern}</code>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${PATTERN_TYPE_STYLES[rule.pattern_type] || 'bg-muted text-muted-foreground'}`}>
                          {rule.pattern_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="font-mono text-sm text-muted-foreground">{rule.priority}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleActive(rule)}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                            rule.is_active
                              ? 'bg-profit/10 text-profit border border-profit/20 hover:bg-profit/20'
                              : 'bg-muted text-muted-foreground border border-border hover:bg-secondary'
                          }`}
                        >
                          {rule.is_active ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingRule(rule)
                              setRuleFormData({ category_id: rule.category_id, pattern: rule.pattern, pattern_type: rule.pattern_type, priority: rule.priority })
                              setIsRuleModalOpen(true)
                            }}
                            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
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

      {/* Rule Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up">
            <h3 className="font-display text-lg font-semibold text-foreground mb-5">{editingRule ? 'Edit Rule' : 'New Rule'}</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Category</label>
                <select
                  value={ruleFormData.category_id}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, category_id: parseInt(e.target.value) })}
                  disabled={!!editingRule}
                  className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value={0}>Select a category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Pattern</label>
                <Input
                  value={ruleFormData.pattern}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, pattern: e.target.value })}
                  placeholder="e.g., Walmart, ^ATM.*"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Pattern Type</label>
                <select
                  value={ruleFormData.pattern_type}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, pattern_type: e.target.value as 'keyword' | 'exact' | 'regex' })}
                  className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="keyword">Keyword — matches anywhere in description</option>
                  <option value="exact">Exact — full description match</option>
                  <option value="regex">Regex — regular expression</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Priority (0–100)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={ruleFormData.priority}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, priority: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button variant="outline" size="sm" onClick={() => { setIsRuleModalOpen(false); resetRuleForm() }}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSaveRule} className="gap-1.5">
                <Check className="w-3.5 h-3.5" /> {editingRule ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up">
            <h3 className="font-display text-lg font-semibold text-foreground mb-5">{editingCategory ? 'Edit Category' : 'New Category'}</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Name</label>
                <Input
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="e.g., Groceries"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setCategoryFormData({ ...categoryFormData, color })}
                      className={`w-8 h-8 rounded-lg transition-all ${categoryFormData.color === color ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={categoryFormData.color}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                  className="w-full h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                />
              </div>
              {/* Global toggle */}
              {!editingCategory ? (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryFormData.is_global || false}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, is_global: e.target.checked })}
                    className="w-4 h-4 rounded border-border bg-secondary accent-primary"
                  />
                  <span className="text-sm text-foreground">Available to all users</span>
                </label>
              ) : editingCategory.is_global ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Globe className="w-3 h-3" /> Global category
                  </Badge>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setCategoryFormData({ ...categoryFormData, icon })}
                      className={`w-9 h-9 text-lg rounded-lg border transition-all flex items-center justify-center ${
                        categoryFormData.icon === icon
                          ? 'border-primary bg-primary/10 scale-110'
                          : 'border-border bg-secondary hover:scale-105'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button variant="outline" size="sm" onClick={() => { setIsCategoryModalOpen(false); resetCategoryForm() }}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSaveCategory} className="gap-1.5">
                <Check className="w-3.5 h-3.5" /> {editingCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
