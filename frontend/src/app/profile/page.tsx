"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Profile() {
  const router = useRouter();
  const { user } = useStore();

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/admin");
      return;
    }
    router.replace(user ? "/dashboard" : "/login");
  }, [router, user]);

  return <div className="min-h-screen bg-[var(--color-bg)]" />;
}
