import { useState } from 'react'
import { Category } from '../../services/api'
import { ChevronDown } from 'lucide-react'

interface CategorySelectorProps {
  categories: Category[]
  selectedCategoryId: number | null
  suggestedCategoryName?: string
  onChange: (categoryId: number | null) => void
  disabled?: boolean
}

export default function CategorySelector({
  categories,
  selectedCategoryId,
  suggestedCategoryName,
  onChange,
  disabled = false,
}: CategorySelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

  const handleSelect = (categoryId: number | null) => {
    onChange(categoryId)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full h-8 px-3 rounded-lg border border-border text-sm text-left flex items-center justify-between gap-2 transition-colors ${
          disabled
            ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            : 'bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {selectedCategory ? (
            <>
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: selectedCategory.color }}
              />
              <span className="truncate text-foreground">{selectedCategory.name}</span>
            </>
          ) : suggestedCategoryName ? (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20 truncate">
              Suggested: {suggestedCategoryName}
            </span>
          ) : (
            <span className="text-muted-foreground">Select category…</span>
          )}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-2xl z-[1000] overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                type="text"
                placeholder="Search categories…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1.5 text-sm bg-secondary rounded-md border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              <div
                onClick={() => handleSelect(null)}
                className={`px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                  !selectedCategoryId
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                No category
              </div>
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  onClick={() => handleSelect(category.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                    category.id === selectedCategoryId
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                  {category.is_global && (
                    <span className="text-[10px] text-muted-foreground ml-1">· Global</span>
                  )}
                </div>
              ))}
              {filteredCategories.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No categories found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
