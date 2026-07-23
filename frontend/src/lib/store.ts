"use client";

import { create } from "zustand";
import { User } from "@/types";
import { api } from "@/lib/api";

interface AppState {
  user: User | null;
  theme: "light" | "dark";
  selectedState: string;
  selectedDistrict: string;
  selectedMandal: string;
  setUser: (user: User | null) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  logout: () => Promise<void>;
  setLocation: (state: string, district: string, mandal: string) => void;
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

function getStoredLocation(): { state: string; district: string; mandal: string } {
  if (typeof window === "undefined") return { state: "", district: "", mandal: "" };
  try {
    const raw = localStorage.getItem("location");
    return raw ? JSON.parse(raw) : { state: "", district: "", mandal: "" };
  } catch {
    return { state: "", district: "", mandal: "" };
  }
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

export const useStore = create<AppState>((set) => {
  const storedLocation = getStoredLocation();
  return {
    user: getStoredUser(),
    theme: getStoredTheme(),
    selectedState: storedLocation.state,
    selectedDistrict: storedLocation.district,
    selectedMandal: storedLocation.mandal,

    setUser: (user) => {
      if (user) {
        const currentTheme = localStorage.getItem("theme") as "light" | "dark" | null;
        const theme = currentTheme || user.theme_preference || "dark";
        // Pre-populate location from user profile if available
        const storedLoc = getStoredLocation();
        const state = storedLoc.state || user.state || "";
        const district = storedLoc.district || user.district || "";
        const mandal = storedLoc.mandal || user.mandal || "";
        set({ user, theme, selectedState: state, selectedDistrict: district, selectedMandal: mandal });
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("theme", theme);
        if (state || district || mandal) {
          localStorage.setItem("location", JSON.stringify({ state, district, mandal }));
        }
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

    logout: async () => {
      try {
        await api.logout();
      } finally {
        set({ user: null, theme: "dark" });
        localStorage.removeItem("user");
        localStorage.removeItem("location");
        localStorage.setItem("theme", "dark");
        applyTheme("dark");
      }
    },

    setLocation: (state, district, mandal) => {
      set({ selectedState: state, selectedDistrict: district, selectedMandal: mandal });
      localStorage.setItem("location", JSON.stringify({ state, district, mandal }));
    },
  };
});
