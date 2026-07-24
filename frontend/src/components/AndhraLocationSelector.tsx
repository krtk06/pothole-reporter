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
  includeVillage?: boolean;
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
  includeVillage = true,
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
    village: selection.subdistrict ? "Search city / village" : "Select mandal first",
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
    const selectedId =
      level === "district"
        ? selection.district?.id
        : level === "subdistrict"
        ? selection.subdistrict?.id
        : selection.village?.id;

    return (
      <div className="relative min-w-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            value={queries[level]}
            disabled={disabled}
            onFocus={() => {
              setActiveLevel(level);
              void loadOptions(level, queries[level]);
            }}
            onChange={(event) => updateQuery(level, event.target.value)}
            placeholder={placeholders[level]}
            className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] pl-10 pr-10 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-55"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
            {loadingLevel === level ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {open && !disabled && (
          <div className="mt-2 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl">
            {items.length === 0 && loadingLevel !== level ? (
              <div className="px-3 py-3 text-xs text-[var(--color-text-secondary)]">No results found</div>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto p-1.5 [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent]">
                  {items.map((area) => {
                    const selected = selectedId === area.id;
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectArea(level, area)}
                        className={`block w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                          selected
                            ? "bg-[var(--color-muted)] text-[var(--color-heading)]"
                            : "text-[var(--color-text-primary)] hover:bg-[var(--color-muted)]"
                        }`}
                      >
                        <span className="block truncate font-medium leading-5">{area.name}</span>
                        <span className="mt-0.5 block truncate text-xs leading-4 text-[var(--color-text-secondary)]">
                          {area.displayName}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-[var(--color-border)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                  Showing up to 30 matches
                </div>
              </>
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
      {includeVillage && field("village", !selection.subdistrict)}
    </div>
  );
}
