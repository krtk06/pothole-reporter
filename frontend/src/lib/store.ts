"use client";

import { create } from "zustand";
import type { AdministrativeArea, User } from "@/types";
import { api } from "@/lib/api";

interface AppState {
  user: User | null;
  theme: "light" | "dark";
  selectedState: string;
  selectedDistrict: string;
  selectedMandal: string;
  selectedVillage: string;
  selectedArea: AdministrativeArea | null;
  setUser: (user: User | null) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  logout: () => Promise<void>;
  setLocation: (state: string, district: string, mandal: string) => void;
  setAdministrativeArea: (area: AdministrativeArea | null) => void;
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

function getStoredLocation(): {
  state: string;
  district: string;
  mandal: string;
  village: string;
  area: AdministrativeArea | null;
} {
  const empty = { state: "", district: "", mandal: "", village: "", area: null };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem("location");
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
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
    selectedVillage: storedLocation.village,
    selectedArea: storedLocation.area,

    setUser: (user) => {
      if (user) {
        const currentTheme = localStorage.getItem("theme") as "light" | "dark" | null;
        const theme = currentTheme || user.theme_preference || "dark";
        // Pre-populate location from user profile if available
        const storedLoc = getStoredLocation();
        const state = storedLoc.state || user.state || "";
        const district = storedLoc.district || user.district || "";
        const mandal = storedLoc.mandal || user.mandal || "";
        set({
          user,
          theme,
          selectedState: state,
          selectedDistrict: district,
          selectedMandal: mandal,
          selectedVillage: storedLoc.village,
          selectedArea: storedLoc.area,
        });
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("theme", theme);
        if (state || district || mandal) {
          localStorage.setItem("location", JSON.stringify({
            state,
            district,
            mandal,
            village: storedLoc.village,
            area: storedLoc.area,
          }));
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
        set({
          user: null,
          theme: "dark",
          selectedState: "",
          selectedDistrict: "",
          selectedMandal: "",
          selectedVillage: "",
          selectedArea: null,
        });
        localStorage.removeItem("user");
        localStorage.removeItem("location");
        localStorage.setItem("theme", "dark");
        applyTheme("dark");
      }
    },

    setLocation: (state, district, mandal) => {
      set({ selectedState: state, selectedDistrict: district, selectedMandal: mandal, selectedVillage: "", selectedArea: null });
      localStorage.setItem("location", JSON.stringify({ state, district, mandal, village: "", area: null }));
    },

    setAdministrativeArea: (area) => {
      if (!area) {
        set({ selectedState: "", selectedDistrict: "", selectedMandal: "", selectedVillage: "", selectedArea: null });
        localStorage.removeItem("location");
        return;
      }

      const location = {
        state: area.stateName || "Andhra Pradesh",
        district: area.districtName || "",
        mandal: area.subdistrictName || "",
        village: area.type === "village" ? area.name : "",
        area,
      };
      set({
        selectedState: location.state,
        selectedDistrict: location.district,
        selectedMandal: location.mandal,
        selectedVillage: location.village,
        selectedArea: area,
      });
      localStorage.setItem("location", JSON.stringify(location));
    },
  };
});
