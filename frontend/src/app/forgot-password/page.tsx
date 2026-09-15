"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import AuthShell from "@/components/AuthShell";
import { Field, Input, MagneticButton } from "@/components/macadam";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot password"
      description="Enter your email and we'll send you a reset link."
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-lg border border-ok/40 bg-ok/10 px-4 py-3">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
          <p className="text-sm text-ink">
            If that email is registered, a reset link has been sent.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@department.gov.in"
              autoComplete="email"
              required
            />
          </Field>
          {error && <p className="text-sm text-bad">{error}</p>}
          <MagneticButton type="submit" variant="primary" block disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending
              </>
            ) : (
              "Send reset link"
            )}
          </MagneticButton>
        </form>
      )}
    </AuthShell>
  );
}
