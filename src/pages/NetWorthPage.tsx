import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { Wallet, Pencil, Trash2, Target, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToast } from "../components/Toast";
import { ToastContainer } from "../components/Toast";
import UpdateBalanceModal from "../components/UpdateBalanceModal";
import HouseholdScopePicker from "../components/HouseholdScopePicker";
import {
  getCurrentNetWorth,
  listSavingsGoals,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  type NetWorthCurrent,
  type SavingsGoal,
  type SavingsGoalCreate,
  type SavingsGoalUpdate,
  type Account,
  type AccountTypeTotal,
} from "../services/api";
import { formatCurrency } from "../lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

// Account types that support manual balance entry (Option B: type-based check;
// avoids a second /accounts API call. Trade-off: a Checking/Savings with no
// default_parser won't show the button — acceptable for v1 since those types
// normally have CSV parsers and don't need manual updates.)
const MANUAL_BALANCE_TYPES = new Set([
  "high_yield_savings",
  "investment",
  "cd",
  "cash",
  "other",
]);

function canUpdateBalanceManually(accountType: string): boolean {
  return MANUAL_BALANCE_TYPES.has(accountType);
}

// Palette for donut slices by account type
const TYPE_COLORS: Record<string, string> = {
  checking: "hsl(220 60% 55%)",
  savings: "hsl(158 100% 42%)",
  high_yield_savings: "hsl(165 80% 38%)",
  investment: "hsl(270 60% 60%)",
  cd: "hsl(200 70% 50%)",
  cash: "hsl(45 90% 55%)",
  other: "hsl(220 10% 50%)",
  credit_card: "hsl(350 84% 57%)",
};

function getTypeColor(accountType: string): string {
  return TYPE_COLORS[accountType] ?? "hsl(220 10% 50%)";
}

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  high_yield_savings: "High Yield Savings",
  investment: "Investment",
  cd: "CD",
  cash: "Cash",
  other: "Other",
  credit_card: "Credit Card",
};

function getTypeLabel(accountType: string): string {
  return TYPE_LABELS[accountType] ?? accountType;
}

// ─── Currency helpers ─────────────────────────────────────────────────────────

/**
 * Render a currency amount with U+2212 (−) for negatives.
 * `formatCurrency` from utils uses Intl which emits a plain hyphen-minus (U+0045).
 * We format Math.abs(amount) and prepend U+2212 manually.
 */
function formatAmount(amount: number): string {
  const abs = formatCurrency(Math.abs(amount));
  return amount < 0 ? `−${abs}` : abs;
}

// ─── Delta chip ───────────────────────────────────────────────────────────────

interface DeltaChipProps {
  label: string;
  abs: number | null;
  pct: number | null;
}

function DeltaChip({ label, abs, pct }: DeltaChipProps) {
  if (abs === null || pct === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {label}: N/A (insufficient history)
      </span>
    );
  }
  const isPositive = abs >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
        isPositive
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-destructive/10 text-destructive border-destructive/20"
      }`}
    >
      {label} {isPositive ? "+" : "−"}
      {formatCurrency(Math.abs(abs))} ({isPositive ? "+" : "−"}
      {Math.abs(pct).toFixed(2)}%)
    </span>
  );
}

// ─── New Goal Modal ───────────────────────────────────────────────────────────

interface NewGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (goal: SavingsGoal) => void;
  netWorthTotal: number;
  byType: AccountTypeTotal[];
}

function NewGoalModal({
  isOpen,
  onClose,
  onCreated,
  byType,
}: NewGoalModalProps) {
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const allAccounts = byType.flatMap((t) => t.accounts);

  const handleClose = () => {
    setGoalName("");
    setTargetAmount("");
    setTargetDate("");
    setAccountId("");
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    setError("");
    if (!goalName.trim()) {
      setError("Goal name is required");
      return;
    }
    const amt = parseFloat(targetAmount);
    if (!targetAmount || isNaN(amt) || amt <= 0) {
      setError("Target amount must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const data: SavingsGoalCreate = {
        name: goalName.trim(),
        target_amount: amt,
        target_date: targetDate || undefined,
        account_id: accountId ? parseInt(accountId, 10) : undefined,
      };
      const created = await createSavingsGoal(data);
      onCreated(created);
      handleClose();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to create goal",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold text-foreground mb-5">
          New Savings Goal
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Goal Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g., Emergency Fund"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Target Amount <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Target Date (optional)
            </label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Link to Account (optional)
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Use total net worth</option>
              {allAccounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Track progress against a specific account balance
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create Goal"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Goal Modal ──────────────────────────────────────────────────────────

interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (goal: SavingsGoal) => void;
  goal: SavingsGoal;
}

function EditGoalModal({
  isOpen,
  onClose,
  onUpdated,
  goal,
}: EditGoalModalProps) {
  const [goalName, setGoalName] = useState(goal.name);
  const [targetAmount, setTargetAmount] = useState(String(goal.target_amount));
  const [targetDate, setTargetDate] = useState(goal.target_date ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Sync when goal prop changes (different goal opened)
  useEffect(() => {
    setGoalName(goal.name);
    setTargetAmount(String(goal.target_amount));
    setTargetDate(goal.target_date ?? "");
    setError("");
  }, [goal]);

  const handleClose = () => {
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    setError("");
    if (!goalName.trim()) {
      setError("Goal name is required");
      return;
    }
    const amt = parseFloat(targetAmount);
    if (!targetAmount || isNaN(amt) || amt <= 0) {
      setError("Target amount must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const data: SavingsGoalUpdate = {
        name: goalName.trim(),
        target_amount: amt,
        target_date: targetDate || undefined,
      };
      const updated = await updateSavingsGoal(goal.id, data);
      onUpdated(updated);
      handleClose();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to update goal",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold text-foreground mb-5">
          Edit Goal
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Goal Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Target Amount <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Target Date (optional)
            </label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Goal Progress Bar ────────────────────────────────────────────────────────

function goalBarColor(goal: SavingsGoal): string {
  const { projected_date, reason } = goal.projection;
  if (reason === "no positive trend") return "bg-destructive";
  if (!projected_date || !goal.target_date) return "bg-primary";
  return projected_date <= goal.target_date ? "bg-primary" : "bg-amber-400";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface UpdateBalanceTarget {
  account: Account;
}

export default function NetWorthPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<NetWorthCurrent | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<number | null>(null);

  const [updateBalanceTarget, setUpdateBalanceTarget] =
    useState<UpdateBalanceTarget | null>(null);

  const { toasts, showToast, dismissToast } = useToast();
  const [householdId, setHouseholdId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [nw, gl] = await Promise.all([
        getCurrentNetWorth(householdId),
        listSavingsGoals(),
      ]);
      setCurrent(nw);
      setGoals(gl);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to load net worth data",
      );
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGoalCreated = (goal: SavingsGoal) => {
    setGoals((prev) => [...prev, goal]);
    showToast(`Goal "${goal.name}" created`, "success");
  };

  const handleGoalUpdated = (updated: SavingsGoal) => {
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    showToast("Goal updated", "success");
  };

  const handleDeleteGoal = async (goalId: number) => {
    setDeletingGoalId(goalId);
    try {
      await deleteSavingsGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      showToast("Goal deleted", "success");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      showToast(detail ?? "Failed to delete goal", "error");
    } finally {
      setDeletingGoalId(null);
    }
  };

  // After a successful balance update, refresh all data
  const handleBalanceUpdateSuccess = useCallback(() => {
    setUpdateBalanceTarget(null);
    setLoading(true);
    loadData();
  }, [loadData]);

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-8">
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (!current || current.by_type.length === 0) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <Wallet className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No accounts found. Create an account to track your net worth.
          </p>
        </div>
      </div>
    );
  }

  const assetTypes = current.by_type.filter((t) => !t.is_liability);
  const liabilityTypes = current.by_type.filter((t) => t.is_liability);
  const total = current.total;

  // Donut data — assets only
  const donutData =
    assetTypes.length > 0 && current.assets > 0
      ? assetTypes.map((t) => ({
          name: getTypeLabel(t.account_type),
          value: Math.max(t.total, 0),
          color: getTypeColor(t.account_type),
        }))
      : [
          {
            name: "No balances recorded yet",
            value: 1,
            color: "hsl(220 10% 25%)",
          },
        ];

  // Sparkline data
  const sparklineData = current.sparkline.map((v, i) => ({ i, v }));

  // Negative total display: formatCurrency uses plain hyphen; we prefix U+2212 manually
  const totalDisplay =
    total < 0 ? `−${formatCurrency(Math.abs(total))}` : formatCurrency(total);

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* ── Hero card ── */}
      <div className="bg-card border border-border rounded-2xl p-8 animate-fade-up">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Net Worth
          </p>
          <HouseholdScopePicker value={householdId} onChange={setHouseholdId} />
        </div>

        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="space-y-3">
            <span
              className={`font-display text-5xl font-bold ${
                total < 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {totalDisplay}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <DeltaChip
                label="MoM"
                abs={current.delta.mom_abs}
                pct={current.delta.mom_pct}
              />
              <DeltaChip
                label="YoY"
                abs={current.delta.yoy_abs}
                pct={current.delta.yoy_pct}
              />
            </div>

            <div className="flex gap-4 font-mono text-sm">
              <span className="text-primary">
                +{formatCurrency(current.assets)} assets
              </span>
              <span className="text-destructive">
                {current.liabilities > 0
                  ? `−${formatCurrency(current.liabilities)} liabilities`
                  : "$0.00 liabilities"}
              </span>
            </div>
          </div>

          {/* Sparkline */}
          {sparklineData.length > 1 && (
            <div className="w-48 h-10 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(158 100% 42%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          As of {current.as_of}
        </p>
      </div>

      {/* ── Allocation row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-up-1">
        {/* Donut */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
            Asset Allocation
          </p>

          <div className="flex items-center justify-center">
            <PieChart width={200} height={200}>
              <Pie
                data={donutData}
                dataKey="value"
                cx={100}
                cy={100}
                innerRadius={60}
                outerRadius={90}
                strokeWidth={2}
                stroke="hsl(228 12% 9%)"
              >
                {donutData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatAmount(value)}
                contentStyle={{
                  background: "hsl(228 12% 9%)",
                  border: "1px solid hsl(225 10% 16%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "#FFFFFF" }}
                labelStyle={{ color: "#FFFFFF" }}
              />
            </PieChart>
          </div>

          {/* Legend */}
          <div className="mt-3 space-y-1.5">
            {donutData.map((d, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-xs text-muted-foreground flex-1">
                  {d.name}
                </span>
                <span className="text-xs font-mono text-foreground">
                  {formatAmount(d.value)}
                </span>
              </div>
            ))}
          </div>

          {/* Liabilities bar */}
          {liabilityTypes.length > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive font-mono font-semibold">
                {"−"}
                {formatCurrency(current.liabilities)} total liabilities
              </p>
            </div>
          )}
        </div>

        {/* By-type list */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
            By Account Type
          </p>

          <div className="space-y-4">
            {assetTypes.map((typeGroup) => {
              const pct =
                current.assets > 0
                  ? (typeGroup.total / current.assets) * 100
                  : 0;

              return (
                <div key={typeGroup.account_type} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground font-medium">
                      {getTypeLabel(typeGroup.account_type)}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({typeGroup.accounts.length})
                      </span>
                    </span>
                    <span className="font-mono text-sm text-foreground font-semibold">
                      {formatAmount(typeGroup.total)}
                    </span>
                  </div>

                  {/* Percent bar */}
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: getTypeColor(typeGroup.account_type),
                      }}
                    />
                  </div>

                  {/* Individual accounts in this type group */}
                  <div className="space-y-1 pt-1">
                    {typeGroup.accounts.map((acct) => {
                      const isHYSANoSnapshot =
                        typeGroup.account_type === "high_yield_savings" &&
                        Number(acct.balance) === 0;

                      // Build a synthetic Account for UpdateBalanceModal; we only
                      // have AccountSummary here (id, name, balance). The full
                      // Account shape is a superset — we fill optional fields as
                      // undefined which is type-safe.
                      const syntheticAccount: Account = {
                        id: acct.id,
                        name: acct.name,
                        account_type: typeGroup.account_type,
                        currency: "USD",
                        current_balance: acct.balance,
                        created_at: "",
                      };

                      return (
                        <div
                          key={acct.id}
                          className="flex items-center justify-between pl-2"
                        >
                          <div>
                            <span className="text-xs text-muted-foreground">
                              {acct.name}
                            </span>
                            {/* Directive 3: HYSA-with-no-snapshot helper text */}
                            {isHYSANoSnapshot && (
                              <p className="text-xs text-muted-foreground opacity-60">
                                No snapshot — use Update Balance
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-foreground">
                              {formatAmount(acct.balance)}
                            </span>
                            {canUpdateBalanceManually(
                              typeGroup.account_type,
                            ) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  setUpdateBalanceTarget({
                                    account: syntheticAccount,
                                  })
                                }
                              >
                                Update
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Liabilities in list */}
            {liabilityTypes.map((typeGroup) => (
              <div key={typeGroup.account_type} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-destructive font-medium">
                    {getTypeLabel(typeGroup.account_type)}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({typeGroup.accounts.length})
                    </span>
                  </span>
                  <span className="font-mono text-sm text-destructive font-semibold">
                    {"−"}
                    {formatCurrency(typeGroup.total)}
                  </span>
                </div>
                <div className="h-1.5 bg-destructive/20 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-destructive/60 transition-all"
                    style={{
                      width: `${Math.min(
                        (typeGroup.total / (current.liabilities || 1)) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Goals section ── */}
      <div className="animate-fade-up-2">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Savings Goals
          </p>
          <Button size="sm" onClick={() => setNewGoalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Goal
          </Button>
        </div>

        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 bg-card border border-border rounded-2xl">
            <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
              <Target className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No goals yet. Create one to start tracking progress.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const barPct = Math.min(goal.progress_pct, 100);
              const barColor = goalBarColor(goal);
              const isDeleting = deletingGoalId === goal.id;

              return (
                <div
                  key={goal.id}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-display text-sm font-semibold text-foreground">
                        {goal.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {formatAmount(goal.current_amount)} of{" "}
                        {formatAmount(goal.target_amount)}
                        <span className="ml-2 text-muted-foreground opacity-60">
                          ({goal.progress_pct.toFixed(1)}%)
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setEditingGoal(goal)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Edit goal"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Delete goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  {/* Projection + target date */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {goal.projection.projected_date
                        ? `Projected: ${goal.projection.projected_date}`
                        : goal.projection.reason === "no positive trend"
                          ? "No positive trend detected"
                          : "Projection unavailable"}
                    </span>
                    {goal.target_date && (
                      <span className="font-mono text-xs text-muted-foreground">
                        Target: {goal.target_date}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <NewGoalModal
        isOpen={newGoalOpen}
        onClose={() => setNewGoalOpen(false)}
        onCreated={handleGoalCreated}
        netWorthTotal={current.total}
        byType={current.by_type}
      />

      {editingGoal && (
        <EditGoalModal
          isOpen={true}
          onClose={() => setEditingGoal(null)}
          onUpdated={handleGoalUpdated}
          goal={editingGoal}
        />
      )}

      {updateBalanceTarget && (
        <UpdateBalanceModal
          isOpen={true}
          onClose={() => setUpdateBalanceTarget(null)}
          onSuccess={handleBalanceUpdateSuccess}
          account={updateBalanceTarget.account}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
