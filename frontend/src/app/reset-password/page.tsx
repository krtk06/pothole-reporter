"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";

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
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-8">
        <h1 className="text-2xl font-bold text-[var(--color-heading)] text-center mb-2">Reset Password</h1>

        {success ? (
          <div className="text-center">
            <p className="text-sm text-green-500 mb-4">Password has been reset. You can now log in.</p>
            <Link href="/" className="text-sm text-[var(--color-text-primary)] hover:underline">Go to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-2 border-[var(--color-border)] h-12 w-full rounded-md bg-[var(--color-bg)] px-4 outline-none focus:border-[var(--color-text-primary)]"
              required
              minLength={8}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="border-2 border-[var(--color-border)] h-12 w-full rounded-md bg-[var(--color-bg)] px-4 outline-none focus:border-[var(--color-text-primary)]"
              required
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !token}
              className="rounded-md bg-[var(--color-border)] px-8 py-2.5 text-sm text-white hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center"><p className="text-[var(--color-text-secondary)]">Loading...</p></div>}>
      <ResetForm />
    </Suspense>
  );
}
