import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface Option {
  value: number
  label: string
}

interface MultiSelectFilterProps {
  options: Option[]
  selected: number[]
  onChange: (selected: number[]) => void
  placeholder: string
}

export default function MultiSelectFilter({ options, selected, onChange, placeholder }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggle = (value: number) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  const selectedLabels = options.filter((o) => selected.includes(o.value))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">
          {selectedLabels.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : selectedLabels.length <= 2 ? (
            selectedLabels.map((o) => o.label).join(', ')
          ) : (
            `${selectedLabels.length} selected`
          )}
        </span>
        <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {selected.length > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange([]) }}
          className="absolute right-8 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Clear selection"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-xl animate-fade-up overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map((option) => {
              const isChecked = selected.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-secondary/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(option.value)}
                    className="w-3.5 h-3.5 accent-primary cursor-pointer"
                  />
                  <span className={isChecked ? 'text-foreground' : 'text-muted-foreground'}>{option.label}</span>
                </label>
              )
            })}
            {options.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No options</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
