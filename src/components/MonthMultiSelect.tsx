import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface MonthMultiSelectProps {
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  monthCount?: number
}

export default function MonthMultiSelect({ selected, onChange, placeholder = 'Select months', monthCount = 24 }: MonthMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const months = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < monthCount; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' })
      options.push({ value, label })
    }
    return options
  }, [monthCount])

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  const selectedLabels = months.filter((m) => selected.includes(m.value))

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
            selectedLabels.map((m) => m.label).join(', ')
          ) : (
            `${selectedLabels.length} months`
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
            {months.map((month) => {
              const isChecked = selected.includes(month.value)
              return (
                <label
                  key={month.value}
                  className="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-secondary/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(month.value)}
                    className="w-3.5 h-3.5 accent-primary cursor-pointer"
                  />
                  <span className={isChecked ? 'text-foreground' : 'text-muted-foreground'}>{month.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
