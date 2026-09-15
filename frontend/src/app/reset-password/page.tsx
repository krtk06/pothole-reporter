"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import AuthShell from "@/components/AuthShell";
import { Field, Input, MagneticButton } from "@/components/macadam";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing reset token. Check your reset link.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token!, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token && !error) return null;

  return (
    <AuthShell title="Reset password" description="Choose a new password for your admin account.">
      {success ? (
        <div className="flex items-start gap-3 rounded-lg border border-ok/40 bg-ok/10 px-4 py-3">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
          <p className="text-sm text-ink">Password has been reset. You can now sign in.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="New password" htmlFor="new-password" required>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-password" required>
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </Field>
          {error && <p className="text-sm text-bad">{error}</p>}
          <MagneticButton type="submit" variant="primary" block disabled={loading || !token}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Resetting
              </>
            ) : (
              "Reset password"
            )}
          </MagneticButton>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPassword() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <span className="font-mono text-sm text-ink3">Loading…</span>
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
