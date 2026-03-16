import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardSummary, getAccounts, type DashboardSummary, type Account } from '../services/api'
import { formatCurrency, formatDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import CreateAccountModal from '../components/CreateAccountModal'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createAccountOpen, setCreateAccountOpen] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [data, accts] = await Promise.all([getDashboardSummary(), getAccounts()])
      setDashboardData(data)
      setAccounts(accts)
    } catch {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const handler = () => fetchData()
    window.addEventListener('csv-import-success', handler)
    return () => window.removeEventListener('csv-import-success', handler)
  }, [])

  const netSavings = dashboardData
    ? dashboardData.month_income - dashboardData.month_expenses
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-up">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Overview</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreateAccountOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Balance */}
        <Card className="animate-fade-up animate-fade-up-1 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
          <CardHeader>
            <CardTitle>Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="font-mono text-3xl font-semibold text-foreground">
                  {dashboardData ? formatCurrency(dashboardData.total_balance) : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1.5">
                  across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Month Income */}
        <Card className="animate-fade-up animate-fade-up-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[hsl(158_100%_42%)]" />
          <CardHeader>
            <CardTitle>This Month Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="font-mono text-3xl font-semibold text-profit">
                  {dashboardData ? formatCurrency(dashboardData.month_income) : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1.5">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[hsl(158_100%_42%/0.1)]">
                <TrendingUp className="w-5 h-5 text-profit" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Month Expenses */}
        <Card className="animate-fade-up animate-fade-up-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-destructive" />
          <CardHeader>
            <CardTitle>This Month Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="font-mono text-3xl font-semibold text-destructive">
                  {dashboardData ? formatCurrency(dashboardData.month_expenses) : '—'}
                </div>
                <div className={`text-xs mt-1.5 font-medium ${netSavings >= 0 ? 'text-profit' : 'text-destructive'}`}>
                  {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings)} net this month
                </div>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-destructive/10">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2 animate-fade-up animate-fade-up-4">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Recent Transactions</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/transactions')}
              className="h-7 text-xs gap-1 text-muted-foreground"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {!dashboardData || dashboardData.recent_transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <ArrowUpRight className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  No transactions yet. Import a CSV file to get started.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {dashboardData.recent_transactions.map((txn, i) => (
                  <div
                    key={txn.id}
                    className="flex items-center gap-4 px-5 py-3.5 txn-row animate-fade-up"
                    style={{ animationDelay: `${0.05 * i}s` }}
                  >
                    {/* Icon */}
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                      txn.transaction_type === 'income' || txn.transaction_type === 'card_payment' || txn.transaction_type === 'refund'
                        ? 'bg-[hsl(158_100%_42%/0.1)]'
                        : txn.transaction_type === 'transfer'
                        ? 'bg-blue-500/10'
                        : 'bg-destructive/10'
                    }`}>
                      {txn.transaction_type === 'income' || txn.transaction_type === 'card_payment' || txn.transaction_type === 'refund' ? (
                        <ArrowDownRight className="w-4 h-4 text-profit" />
                      ) : txn.transaction_type === 'transfer' ? (
                        <ArrowUpRight className="w-4 h-4 text-blue-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-destructive" />
                      )}
                    </div>

                    {/* Description + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{txn.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatDate(txn.transaction_date)}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">{txn.account_name}</span>
                      </div>
                    </div>

                    {/* Category badge */}
                    {txn.category_name && (
                      <div
                        className="shrink-0 hidden sm:flex items-center px-2 py-0.5 rounded-md text-xs font-medium border"
                        style={{
                          backgroundColor: `${txn.category_color}18`,
                          color: txn.category_color || '#888',
                          borderColor: `${txn.category_color}30`,
                        }}
                      >
                        {txn.category_name}
                      </div>
                    )}

                    {/* Amount */}
                    <div className={`font-mono text-sm font-semibold shrink-0 ${
                      txn.transaction_type === 'income' || txn.transaction_type === 'card_payment' || txn.transaction_type === 'refund'
                        ? 'text-profit'
                        : txn.transaction_type === 'transfer'
                        ? 'text-blue-400'
                        : 'text-destructive'
                    }`}>
                      {txn.transaction_type === 'income' || txn.transaction_type === 'card_payment' || txn.transaction_type === 'refund' ? '+' : '−'}
                      {formatCurrency(Math.abs(txn.amount))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accounts sidebar */}
        <Card className="animate-fade-up animate-fade-up-5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Accounts</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/accounts')}
              className="h-7 text-xs gap-1 text-muted-foreground"
            >
              Manage <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <p className="text-xs text-muted-foreground text-center">No accounts yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateAccountOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add account
                </Button>
              </div>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {account.account_type}
                      {account.account_number_last4 && ` ···${account.account_number_last4}`}
                    </p>
                  </div>
                  <div className="font-mono text-sm font-semibold text-foreground ml-3 shrink-0">
                    {formatCurrency(parseFloat(account.current_balance as string) || 0)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <CreateAccountModal
        isOpen={createAccountOpen}
        onClose={() => setCreateAccountOpen(false)}
        onSuccess={() => { setCreateAccountOpen(false); fetchData() }}
      />
    </div>
  )
}
