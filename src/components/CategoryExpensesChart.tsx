import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { BarChart3 } from 'lucide-react'
import {
  getCategoryExpensesMonthly,
  type CategoryExpensesMonthlyData,
} from '../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface CategoryExpensesChartProps {
  year: number
  householdId?: number | null
}

export default function CategoryExpensesChart({ year, householdId }: CategoryExpensesChartProps) {
  const [data, setData] = useState<CategoryExpensesMonthlyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getCategoryExpensesMonthly(year, householdId)
      .then(setData)
      .catch(() => setError('Failed to load category expenses'))
      .finally(() => setLoading(false))
  }, [year, householdId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!data || data.categories.length === 0 || data.grand_total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No expense data for {year}</p>
      </div>
    )
  }

  const labels = data.months.map((m) => m.label)

  const datasets = data.categories.map((cat) => ({
    label: cat.name,
    data: data.months.map((m) => m.categories[cat.name] ?? 0),
    backgroundColor: cat.color,
    borderRadius: 2,
  }))

  const chartData = { labels, datasets }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'hsl(220, 10%, 50%)',
          font: { family: 'DM Sans, sans-serif', size: 12 },
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8,
          boxHeight: 8,
        },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: 'hsl(228, 12%, 9%)',
        titleColor: 'hsl(220, 10%, 50%)',
        bodyColor: 'hsl(220, 20%, 92%)',
        borderColor: 'hsl(225, 10%, 16%)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 10,
        bodyFont: { family: 'JetBrains Mono, monospace', size: 12 },
        titleFont: { family: 'DM Sans, sans-serif', size: 12 },
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const value = ctx.parsed.y ?? 0
            return ` ${ctx.dataset.label}: $${value.toFixed(2)}`
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: 'hsl(225, 10%, 12%)', drawBorder: false },
        ticks: {
          color: 'hsl(220, 10%, 50%)',
          font: { family: 'DM Sans, sans-serif', size: 12 },
        },
        border: { display: false },
      },
      y: {
        stacked: true,
        grid: { color: 'hsl(225, 10%, 12%)', drawBorder: false },
        ticks: {
          color: 'hsl(220, 10%, 50%)',
          font: { family: 'JetBrains Mono, monospace', size: 11 },
          callback: (value: string | number) => `$${Number(value).toLocaleString()}`,
        },
        border: { display: false },
      },
    },
  }

  return (
    <div style={{ height: 400 }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}
