"use client";

import { create } from "zustand";
import { User } from "@/types";

interface AppState {
  user: User | null;
  theme: "light" | "dark";
  setUser: (user: User | null) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  logout: () => void;
}

function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("theme") as "light" | "dark") || "dark";
}

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

function applyTheme(theme: "light" | "dark") {
  if (typeof window !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

if (typeof window !== "undefined") {
  const stored = localStorage.getItem("theme");
  const theme = (stored as "light" | "dark") || "dark";
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const useStore = create<AppState>((set) => ({
  user: getStoredUser(),
  theme: getStoredTheme(),

  setUser: (user) => {
    if (user) {
      const currentTheme = localStorage.getItem("theme") as "light" | "dark" | null;
      const theme = currentTheme || user.theme_preference || "dark";
      set({ user, theme });
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("theme", theme);
      applyTheme(theme);
    } else {
      set({ user: null });
      localStorage.removeItem("user");
    }
  },

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem("theme", theme);
    applyTheme(theme);
  },

  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("theme", newTheme);
      applyTheme(newTheme);
      return { theme: newTheme };
    });
  },

  logout: () => {
    set({ user: null, theme: "dark" });
    localStorage.removeItem("user");
    localStorage.setItem("theme", "dark");
    applyTheme("dark");
  },
}));
