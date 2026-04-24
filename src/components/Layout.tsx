import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  History,
  Tag,
  Settings,
  LogOut,
  Upload,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useState } from 'react'
import CSVUploadModalNew from './CSVUploadModalNew'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/accounts', icon: CreditCard, label: 'Accounts' },
  { to: '/net-worth', icon: Wallet, label: 'Net Worth' },
  { to: '/import-history', icon: History, label: 'History' },
  { to: '/category-rules', icon: Tag, label: 'Rules' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [uploadOpen, setUploadOpen] = useState(false)

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="flex flex-col w-[220px] min-w-[220px] sidebar-bg border-r border-border">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <TrendingUp className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-foreground">
            Vault
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {label}
                  {isActive && (
                    <div className="ml-auto w-1 h-1 rounded-full bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Import CSV button */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-150 border border-primary/20"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
        </div>

        {/* User section */}
        <div className="px-3 pb-4 border-t border-border pt-3">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold text-foreground shrink-0">
              {initials}
            </div>
            <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
              {user?.username}
            </span>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-muted-foreground hover:text-foreground transition-colors ml-auto"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      <CSVUploadModalNew
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => {
          setUploadOpen(false)
          // Trigger a page refresh of data without navigation
          window.dispatchEvent(new Event('csv-import-success'))
        }}
      />
    </div>
  )
}
