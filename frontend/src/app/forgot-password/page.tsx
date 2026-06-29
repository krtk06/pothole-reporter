"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

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
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-8">
        <h1 className="text-2xl font-bold text-[var(--color-heading)] text-center mb-2">Forgot Password</h1>
        <p className="text-sm text-[var(--color-text-secondary)] text-center mb-6">
          Enter your email and we'll send you a reset link.
        </p>

        {sent ? (
          <div className="text-center">
            <p className="text-sm text-green-500 mb-4">If that email is registered, a reset link has been sent.</p>
            <Link href="/" className="text-sm text-[var(--color-text-primary)] hover:underline">Back to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-2 border-[var(--color-border)] h-12 w-full rounded-md bg-[var(--color-bg)] px-4 outline-none focus:border-[var(--color-text-primary)]"
              required
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[var(--color-border)] px-8 py-2.5 text-sm text-white hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <Link href="/" className="text-xs text-[var(--color-text-secondary)] text-center hover:underline">Back to login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
