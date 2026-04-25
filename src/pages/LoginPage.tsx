import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { TrendingUp, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel – branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] sidebar-bg border-r border-border p-12">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary">
            <TrendingUp
              className="w-5 h-5 text-primary-foreground"
              strokeWidth={2.5}
            />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Finance Tracker
          </span>
        </div>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-primary">
              Self-hosted finance
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight text-foreground">
            Track every dollar.
            <br />
            <span className="text-primary">Stay in control.</span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-sm">
            Import your bank statements, categorize spending, and understand
            exactly where your money goes — all in one place.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Banks supported", value: "9+" },
            { label: "Privacy-first", value: "100%" },
            { label: "Auto-categorize", value: "AI" },
            { label: "Self-hosted", value: "Yes" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="p-4 rounded-xl bg-secondary/50 border border-border"
            >
              <div className="font-mono text-xl font-bold text-primary">
                {value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <TrendingUp
                className="w-4 h-4 text-primary-foreground"
                strokeWidth={2.5}
              />
            </div>
            <span className="font-display text-lg font-bold text-foreground">
              Finance Tracker
            </span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Welcome back
            </h2>
            <p className="text-muted-foreground text-sm mt-1.5">
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 font-semibold gap-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link
              to="/register"
              className="text-primary font-medium hover:underline underline-offset-4"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
