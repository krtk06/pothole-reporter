"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, MapPin, Search } from "lucide-react";
import { api } from "@/lib/api";
import {
  getFallbackDistricts,
  getFallbackSubdistricts,
  getFallbackVillages,
} from "@/data/andhraDirectory";
import type { AdministrativeArea } from "@/types";

export interface AndhraLocationSelection {
  district: AdministrativeArea | null;
  subdistrict: AdministrativeArea | null;
  village: AdministrativeArea | null;
}

interface AndhraLocationSelectorProps {
  value?: AndhraLocationSelection;
  onChange: (selection: AndhraLocationSelection) => void;
  label?: boolean;
}

type Level = "district" | "subdistrict" | "village";

const emptySelection: AndhraLocationSelection = {
  district: null,
  subdistrict: null,
  village: null,
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hasSameArea(a?: AdministrativeArea | null, b?: AdministrativeArea | null) {
  return (a?.id || "") === (b?.id || "");
}

export default function AndhraLocationSelector({
  value = emptySelection,
  onChange,
  label = true,
}: AndhraLocationSelectorProps) {
  const [selection, setSelection] = useState<AndhraLocationSelection>(value);
  const [activeLevel, setActiveLevel] = useState<Level | null>(null);
  const [queries, setQueries] = useState<Record<Level, string>>({
    district: value.district?.name || "",
    subdistrict: value.subdistrict?.name || "",
    village: value.village?.name || "",
  });
  const [options, setOptions] = useState<Record<Level, AdministrativeArea[]>>({
    district: [],
    subdistrict: [],
    village: [],
  });
  const [loadingLevel, setLoadingLevel] = useState<Level | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      hasSameArea(value.district, selection.district) &&
      hasSameArea(value.subdistrict, selection.subdistrict) &&
      hasSameArea(value.village, selection.village)
    ) {
      return;
    }

    setSelection(value);
    setQueries({
      district: value.district?.name || "",
      subdistrict: value.subdistrict?.name || "",
      village: value.village?.name || "",
    });
  }, [value]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setActiveLevel(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const placeholders = useMemo(() => ({
    district: "Search district",
    subdistrict: selection.district ? "Search mandal / sub-district" : "Select district first",
    village: selection.subdistrict ? "Search village / city" : "Select mandal first",
  }), [selection.district, selection.subdistrict]);

  async function loadOptions(level: Level, query: string) {
    setLoadingLevel(level);
    try {
      let serverAreas: AdministrativeArea[] = [];
      try {
        const data = await api.getAdministrativeOptions({
          level,
          q: query,
          districtCode: selection.district?.districtCode,
          subdistrictCode: selection.subdistrict?.subdistrictCode,
        });
        serverAreas = data.areas || [];
      } catch {
        serverAreas = [];
      }

      let fallbackAreas: AdministrativeArea[] = [];
      if (level === "district") {
        fallbackAreas = getFallbackDistricts(query);
      } else if (level === "subdistrict" && selection.district?.districtCode) {
        fallbackAreas = getFallbackSubdistricts(selection.district.districtCode, query);
      } else if (
        level === "village" &&
        selection.district?.districtCode &&
        selection.subdistrict?.subdistrictCode
      ) {
        fallbackAreas = getFallbackVillages(
          selection.district.districtCode,
          selection.subdistrict.subdistrictCode,
          query
        );
      }

      const merged = [...serverAreas, ...fallbackAreas]
        .reduce((map, area) => {
          map.set(area.id, area);
          return map;
        }, new Map<string, AdministrativeArea>());

      const normalizedQuery = normalize(query);
      const nextOptions = [...merged.values()]
        .filter((area) => !normalizedQuery || normalize(area.name).startsWith(normalizedQuery))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 30);

      setOptions((current) => ({ ...current, [level]: nextOptions }));
    } finally {
      setLoadingLevel(null);
    }
  }

  function emit(next: AndhraLocationSelection) {
    setSelection(next);
    onChange(next);
  }

  function updateQuery(level: Level, query: string) {
    setQueries((current) => ({ ...current, [level]: query }));
    setActiveLevel(level);
    window.setTimeout(() => void loadOptions(level, query), 100);
  }

  function selectArea(level: Level, area: AdministrativeArea) {
    if (level === "district") {
      setQueries({ district: area.name, subdistrict: "", village: "" });
      emit({ district: area, subdistrict: null, village: null });
    } else if (level === "subdistrict") {
      setQueries((current) => ({ ...current, subdistrict: area.name, village: "" }));
      emit({ district: selection.district, subdistrict: area, village: null });
    } else {
      setQueries((current) => ({ ...current, village: area.name }));
      emit({ ...selection, village: area });
    }
    setActiveLevel(null);
  }

  function field(level: Level, disabled = false) {
    const open = activeLevel === level;
    const items = options[level];

    return (
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            value={queries[level]}
            disabled={disabled}
            onFocus={() => {
              setActiveLevel(level);
              void loadOptions(level, queries[level]);
            }}
            onChange={(event) => updateQuery(level, event.target.value)}
            placeholder={placeholders[level]}
            className="h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] pl-10 pr-10 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-55"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
            {loadingLevel === level ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {open && !disabled && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-56 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
            {items.length === 0 && loadingLevel !== level ? (
              <div className="px-3 py-3 text-xs text-[var(--color-text-secondary)]">No results found</div>
            ) : (
              items.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectArea(level, area)}
                  className="block w-full border-b border-[var(--color-border)] px-3 py-2.5 text-left text-sm text-[var(--color-text-primary)] transition-colors last:border-b-0 hover:bg-[var(--color-muted)]"
                >
                  <span className="block font-medium">{area.name}</span>
                  <span className="block truncate text-xs text-[var(--color-text-secondary)]">{area.displayName}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="grid gap-3">
      {label && (
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-heading)]">
          <MapPin className="h-4 w-4 text-[var(--color-text-secondary)]" />
          Andhra Pradesh location
        </div>
      )}
      {field("district")}
      {field("subdistrict", !selection.district)}
      {field("village", !selection.subdistrict)}
    </div>
  );
}
