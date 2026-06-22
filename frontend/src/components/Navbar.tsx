"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { LogOut, MapPin, Shield } from "lucide-react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import ThemeToggle from "./ThemeToggle";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const { user, logout } = useStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    await api.logout();
    logout();
    router.push("/");
  };

  // Don't render during SSR to avoid hydration mismatch
  if (!mounted || !user) return null;

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border"
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-lg">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">Pothole Reporter</span>

          {user.role === "admin" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                <Shield className="w-3 h-3" />
                Admin
              </span>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user.name}
          </span>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive gap-1.5"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </motion.nav>
  );
}
