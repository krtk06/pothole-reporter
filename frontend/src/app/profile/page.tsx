"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { MapPin, Mail, Phone, Shield, Calendar, LogOut } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Report } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const statusMeta: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", color: "secondary" },
  verified: { label: "Verified", color: "default" },
  rejected: { label: "Rejected", color: "destructive" },
  fixed: { label: "Fixed", color: "outline" },
};

export default function Profile() {
  const { user, logout } = useStore();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!user) { router.push("/"); return; }
    api.getMyReports().then((d) => setReports(d.reports || [])).catch(() => {});
  }, [user]);

  if (!mounted || !user) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Nav */}
      <nav className="flex items-center justify-between p-4 md:px-16 lg:px-24 md:py-6 border-b border-[var(--color-border)]">
        <a className="flex items-center gap-2" href="/dashboard">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-text-primary)] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-bold text-[var(--color-heading)]">Profile</span>
        </a>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="text-[var(--color-text-secondary)]">
            Dashboard
          </Button>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Hero header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 border border-[var(--color-border)] rounded-full px-4 py-1.5 text-xs text-[var(--color-text-secondary)] mb-6">
            <Shield className="w-3 h-3" /> {user.role === "admin" ? "Administrator" : "Public Reporter"}
          </div>
          <div className="w-20 h-20 rounded-full bg-[var(--color-text-primary)]/10 flex items-center justify-center mx-auto mb-4 border-2 border-[var(--color-border)]">
            <span className="text-3xl font-bold text-[var(--color-text-primary)]">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-[var(--color-heading)]">{user.name}</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">{user.email}</p>
        </div>

        {/* Info */}
        <div className="grid gap-4 sm:grid-cols-2 max-w-lg mx-auto mb-10">
          <Card className="p-4 bg-[var(--color-surface)] border-[var(--color-border)] flex items-center gap-3">
            <Mail className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <div>
              <p className="text-xs text-[var(--color-text-secondary)]">Email</p>
              <p className="text-sm font-medium text-[var(--color-heading)]">{user.email}</p>
            </div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)] border-[var(--color-border)] flex items-center gap-3">
            <Shield className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <div>
              <p className="text-xs text-[var(--color-text-secondary)]">Role</p>
              <p className="text-sm font-medium text-[var(--color-heading)] capitalize">{user.role}</p>
            </div>
          </Card>
        </div>

        {/* Activity */}
        <h2 className="text-xl font-bold text-[var(--color-heading)] mb-4 text-center">Recent Reports</h2>
        {reports.length === 0 ? (
          <p className="text-center text-[var(--color-text-secondary)] text-sm">No reports yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto">
            {reports.slice(0, 6).map((r) => (
              <Card key={r.id} className="p-4 bg-[var(--color-surface)] border-[var(--color-border)]">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-mono">
                    <MapPin className="w-3 h-3" />
                    {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                  </div>
                  <Badge variant={statusMeta[r.status]?.color || "secondary"}>{statusMeta[r.status]?.label || r.status}</Badge>
                </div>
                {r.address_notes && <p className="text-xs text-[var(--color-text-secondary)]">{r.address_notes}</p>}
              </Card>
            ))}
          </div>
        )}

        <div className="text-center mt-8">
          <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2" onClick={() => { logout(); router.push("/"); }}>
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </main>
    </div>
  );
}
