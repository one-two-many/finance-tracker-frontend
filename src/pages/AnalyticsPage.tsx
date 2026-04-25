import { useState, useEffect } from 'react'
import { getSankeyData, type SankeyData } from '../services/api'
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { formatCurrency } from '../lib/utils'
import { TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import CategoryExpensesChart from '../components/CategoryExpensesChart'
import HouseholdScopePicker from '../components/HouseholdScopePicker'

// Stable reference — recharts Sankey loops if this is an inline arrow fn
function SankeyNode(props: {
  x?: number; y?: number; width?: number; height?: number; payload?: { name: string; fill: string; value?: number }
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  if (!payload) return null
  const isOut = x + width + 6 > 900
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={payload.fill} rx={3} opacity={0.9} />
      <text
        x={isOut ? x - 8 : x + width + 8}
        y={y + height / 2 - 7}
        textAnchor={isOut ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="600"
        fill="hsl(220 14% 96%)"
        fontFamily="DM Sans, sans-serif"
      >
        {payload.name}
      </text>
      <text
        x={isOut ? x - 8 : x + width + 8}
        y={y + height / 2 + 9}
        textAnchor={isOut ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize="11"
        fill="hsl(220 9% 46%)"
        fontFamily="JetBrains Mono, monospace"
      >
        ${payload.value?.toFixed(2) || '0.00'}
      </text>
    </g>
  )
}

export default function AnalyticsPage() {
  const [sankeyData, setSankeyData] = useState<SankeyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [includeTransfers, setIncludeTransfers] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [householdId, setHouseholdId] = useState<number | null>(null)

  const [startDate, endDate] = (() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const end = new Date(year, month, 0).toISOString().split('T')[0]
    return [start, end]
  })()

  useEffect(() => {
    setLoading(true)
    setError(null)
    getSankeyData(startDate, endDate, includeTransfers, householdId)
      .then(setSankeyData)
      .catch(() => setError('Failed to load analytics data'))
      .finally(() => setLoading(false))
  }, [selectedMonth, includeTransfers, startDate, endDate, householdId])

  const transformedData = sankeyData
    ? (() => {
        const sortedNodes = [...sankeyData.nodes].sort((a, b) => {
          const order: Record<string, number> = { income: 0, cashflow: 1, expense: 2, surplus: 2 }
          return (order[a.type] ?? 1.5) - (order[b.type] ?? 1.5)
        })
        const nodeCount = sortedNodes.length
        const mappedLinks = sankeyData.links
          .map((link) => ({
            source: sortedNodes.findIndex((n) => n.name === link.source),
            target: sortedNodes.findIndex((n) => n.name === link.target),
            value: link.value,
          }))
          .filter(
            (link) =>
              link.source >= 0 &&
              link.target >= 0 &&
              link.source < nodeCount &&
              link.target < nodeCount &&
              link.source !== link.target &&
              link.value > 0
          )
        return {
          nodes: sortedNodes.map((n) => ({ name: n.name, fill: n.color || '#6B7280' })),
          links: mappedLinks,
        }
      })()
    : null

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-fade-up flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Insights</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
        </div>
        <HouseholdScopePicker value={householdId} onChange={setHouseholdId} />
      </div>

      {/* Controls */}
      <Card className="animate-fade-up animate-fade-up-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">Month</label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="flex h-9 w-28 rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={includeTransfers}
                  onChange={(e) => setIncludeTransfers(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-secondary rounded-full peer peer-checked:bg-primary/80 transition-colors border border-border" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm" />
              </div>
              <span className="text-sm text-muted-foreground">Include Transfers</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      {sankeyData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up animate-fade-up-2">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[hsl(158_100%_42%)]" />
            <CardHeader><CardTitle>Total Income</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="font-mono text-2xl font-semibold text-profit">
                  {formatCurrency(sankeyData.summary.total_income)}
                </span>
                <TrendingUp className="w-5 h-5 text-profit" />
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-destructive" />
            <CardHeader><CardTitle>Total Expenses</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className="font-mono text-2xl font-semibold text-destructive">
                  {formatCurrency(sankeyData.summary.total_expenses)}
                </span>
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-[2px] ${sankeyData.summary.net_savings >= 0 ? 'bg-[hsl(158_100%_42%)]' : 'bg-destructive'}`} />
            <CardHeader><CardTitle>Net Savings</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <span className={`font-mono text-2xl font-semibold ${sankeyData.summary.net_savings >= 0 ? 'text-profit' : 'text-destructive'}`}>
                  {sankeyData.summary.net_savings >= 0 ? '+' : ''}{formatCurrency(sankeyData.summary.net_savings)}
                </span>
                <PiggyBank className={`w-5 h-5 ${sankeyData.summary.net_savings >= 0 ? 'text-profit' : 'text-destructive'}`} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sankey chart */}
      <Card className="animate-fade-up animate-fade-up-3">
        <CardHeader className="pb-3">
          <CardTitle>Money Flow</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Income sources → Cash Flow → Expenses & Savings
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : transformedData && transformedData.links.length > 0 ? (
            <ResponsiveContainer width="100%" height={580}>
              <Sankey
                data={transformedData}
                node={<SankeyNode />}
                link={{ stroke: 'hsl(158 100% 42%)', strokeOpacity: 0.12 }}
                nodePadding={50}
                margin={{ top: 20, right: 180, bottom: 20, left: 180 }}
              >
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null
                    const data = payload[0].payload
                    return (
                      <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-xl">
                        {data.source && data.target ? (
                          <>
                            <p className="text-xs text-muted-foreground">{data.source.name} → {data.target.name}</p>
                            <p className="font-mono text-sm font-semibold text-foreground mt-0.5">{formatCurrency(data.value)}</p>
                          </>
                        ) : (
                          <p className="text-sm font-medium text-foreground">{data.name}</p>
                        )}
                      </div>
                    )
                  }}
                />
              </Sankey>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <PiggyBank className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No data for this period</p>
              <p className="text-xs text-muted-foreground/60">Import transactions to see money flow</p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Category Expenses by Month */}
      <Card className="animate-fade-up animate-fade-up-4">
        <CardHeader className="pb-3">
          <CardTitle>Expenses by Category</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monthly breakdown of spending by category — {selectedYear}
          </p>
        </CardHeader>
        <CardContent>
          <CategoryExpensesChart year={selectedYear} householdId={householdId} />
        </CardContent>
      </Card>
    </div>
  )
}
