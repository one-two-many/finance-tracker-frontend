import { useState, useEffect } from "react";
import {
  getSplitwiseCredentials,
  updateSplitwiseCredentials,
  deleteSplitwiseCredentials,
  acceptInvitation,
  declineInvitation,
  listHouseholds,
  listReceivedInvitations,
  type SplitwiseCredentialsStatus,
  type HouseholdSummary,
  type HouseholdInvitation,
} from "../services/api";
import { useAuth } from "../lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import HouseholdManageModal from "../components/HouseholdManageModal";
import { useToast, ToastContainer } from "../components/Toast";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Unlink,
  Link2,
  Users,
  Plus,
  Settings as SettingsIcon,
  Mail,
  Check,
  X as XIcon,
  ShieldCheck,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toasts, showToast, dismissToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [splitwiseStatus, setSplitwiseStatus] =
    useState<SplitwiseCredentialsStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [manageModal, setManageModal] = useState<{
    open: boolean;
    householdId: number | null;
  }>({
    open: false,
    householdId: null,
  });

  const loadHouseholdData = async () => {
    setHouseholdsLoading(true);
    try {
      const [hs, invs] = await Promise.all([
        listHouseholds(),
        listReceivedInvitations(),
      ]);
      setHouseholds(hs);
      setInvitations(invs);
    } catch {
      // Silent — household data is non-critical
    } finally {
      setHouseholdsLoading(false);
    }
  };

  useEffect(() => {
    getSplitwiseCredentials()
      .then(setSplitwiseStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
    loadHouseholdData();
  }, []);

  const handleAcceptInvitation = async (inv: HouseholdInvitation) => {
    try {
      await acceptInvitation(inv.id);
      showToast(`Joined ${inv.household_name}`, "success");
      loadHouseholdData();
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e.response?.data?.detail || "Failed to accept", "error");
    }
  };

  const handleDeclineInvitation = async (inv: HouseholdInvitation) => {
    try {
      await declineInvitation(inv.id);
      showToast(`Declined ${inv.household_name}`, "success");
      loadHouseholdData();
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } };
      showToast(e.response?.data?.detail || "Failed to decline", "error");
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const status = await updateSplitwiseCredentials({ api_key: apiKey });
      setSplitwiseStatus(status);
      setApiKey("");
      setSuccess("Splitwise connected and verified!");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || "Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Splitwise?")) return;
    try {
      await deleteSplitwiseCredentials();
      setSplitwiseStatus({
        is_active: false,
        last_verified_at: null,
        user_info: null,
      });
      setSuccess("Splitwise disconnected");
    } catch {
      setError("Failed to disconnect");
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">
          Configuration
        </p>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Settings
        </h1>
      </div>

      {/* Splitwise card */}
      <Card className="animate-fade-up animate-fade-up-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Splitwise Integration</CardTitle>
            {!loading && (
              <div
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  splitwiseStatus?.is_active
                    ? "bg-profit/10 text-profit border border-profit/20"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${splitwiseStatus?.is_active ? "bg-profit animate-pulse" : "bg-muted-foreground"}`}
                />
                {splitwiseStatus?.is_active ? "Connected" : "Disconnected"}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Connect Splitwise to split expenses with friends directly from
            Finance Tracker.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-3 text-muted-foreground py-4">
              <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : splitwiseStatus?.is_active ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-profit/5 border border-profit/15">
                <CheckCircle2 className="w-5 h-5 text-profit mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Successfully connected
                  </p>
                  {splitwiseStatus.user_info && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {splitwiseStatus.user_info.first_name}{" "}
                      {splitwiseStatus.user_info.last_name}
                    </p>
                  )}
                  {splitwiseStatus.last_verified_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Verified{" "}
                      {new Date(
                        splitwiseStatus.last_verified_at,
                      ).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                className="gap-2"
              >
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Instructions */}
              <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  How to connect
                </p>
                <ol className="space-y-2 text-sm text-foreground">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Visit{" "}
                      <a
                        href="https://secure.splitwise.com/apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline underline-offset-4 inline-flex items-center gap-1"
                      >
                        splitwise.com/apps <ExternalLink className="w-3 h-3" />
                      </a>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold shrink-0 mt-0.5">
                      2
                    </span>
                    <span>Register a new app (use any name)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold shrink-0 mt-0.5">
                      3
                    </span>
                    <span>Copy the "API key" from your app details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold shrink-0 mt-0.5">
                      4
                    </span>
                    <span>Paste it below</span>
                  </li>
                </ol>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Splitwise API Key
                </label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && apiKey.trim()) handleSaveApiKey();
                  }}
                  placeholder="Paste your API key here"
                  className="font-mono text-sm"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-profit/10 border border-profit/20">
                  <CheckCircle2 className="w-4 h-4 text-profit shrink-0" />
                  <p className="text-sm text-profit">{success}</p>
                </div>
              )}

              <Button
                onClick={handleSaveApiKey}
                disabled={saving || !apiKey.trim()}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Connect Splitwise
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations card */}
      {invitations.length > 0 && (
        <Card className="animate-fade-up animate-fade-up-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Pending Household
                Invitations
              </CardTitle>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {invitations.length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Someone invited you to join their household.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-secondary/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">
                      {inv.household_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Invited by @{inv.inviter_username}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvitation(inv)}
                      className="gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineInvitation(inv)}
                      className="gap-1.5"
                    >
                      <XIcon className="w-3.5 h-3.5" /> Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Households card */}
      <Card className="animate-fade-up animate-fade-up-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Households
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setManageModal({ open: true, householdId: null })}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Share joint accounts and combined analytics with people you trust.
          </p>
        </CardHeader>
        <CardContent>
          {householdsLoading ? (
            <div className="flex items-center gap-3 text-muted-foreground py-4">
              <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : households.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No households yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {households.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-secondary/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-foreground font-medium truncate">
                        {h.name}
                      </p>
                      {h.role === "admin" && (
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {h.member_count}{" "}
                      {h.member_count === 1 ? "member" : "members"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setManageModal({ open: true, householdId: h.id })
                    }
                    className="gap-1.5"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" /> Manage
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <HouseholdManageModal
        isOpen={manageModal.open}
        onClose={() => setManageModal({ open: false, householdId: null })}
        householdId={manageModal.householdId}
        currentUserId={user?.id ?? -1}
        onSuccess={(msg) => showToast(msg, "success")}
        onError={(msg) => showToast(msg, "error")}
        onMutated={loadHouseholdData}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
