"use client";

import { create } from "zustand";
import { User } from "@/types";

interface AppState {
  user: User | null;
  token: string | null;
  theme: "light" | "dark";
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  logout: () => void;
}

function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("theme") as "light" | "dark") || "dark";
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
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

// Apply dark mode immediately on load
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("theme");
  const theme = (stored as "light" | "dark") || "dark";
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const useStore = create<AppState>((set) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  theme: getStoredTheme(),

  setUser: (user) => {
    if (user) {
      // Keep existing theme preference — don't override with DB default
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

  setToken: (token) => {
    set({ token });
    if (token) localStorage.setItem("accessToken", token);
    else localStorage.removeItem("accessToken");
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
    set({ user: null, token: null, theme: "dark" });
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    localStorage.setItem("theme", "dark");
    applyTheme("dark");
  },
}));
