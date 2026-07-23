"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Search, MapPin } from "lucide-react";
import { INDIA_LOCATIONS, getDistricts, getMandals } from "@/data/india-locations";

interface LocationSelectorProps {
  selectedState: string;
  selectedDistrict: string;
  selectedMandal: string;
  onStateChange: (state: string) => void;
  onDistrictChange: (district: string) => void;
  onMandalChange: (mandal: string) => void;
  required?: boolean;
  label?: boolean;
}

interface SearchableDropdownProps {
  placeholder: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function SearchableDropdown({ placeholder, value, options, onChange, disabled, icon }: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setSearch(""); }}
        className={`
          w-full flex items-center gap-2 px-4 h-12 rounded-md border-2 text-left text-sm transition-all duration-200
          border-[var(--color-border)] bg-[var(--color-bg)]
          ${disabled ? "opacity-40 cursor-not-allowed" : "hover:border-[var(--color-text-primary)] cursor-pointer"}
          ${open ? "border-[var(--color-text-primary)]" : ""}
        `}
      >
        {icon && <span className="text-[var(--color-text-secondary)] flex-shrink-0">{icon}</span>}
        <span className={`flex-1 truncate font-thin ${value ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
            <Search className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
            />
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[var(--color-text-secondary)] text-center">No results</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); setSearch(""); }}
                  className={`
                    w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--color-muted)] cursor-pointer
                    ${opt === value ? "text-[var(--color-text-primary)] font-medium bg-[var(--color-muted-surface)]" : "text-[var(--color-text-secondary)]"}
                  `}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LocationSelector({
  selectedState,
  selectedDistrict,
  selectedMandal,
  onStateChange,
  onDistrictChange,
  onMandalChange,
  required = false,
  label = true,
}: LocationSelectorProps) {
  const stateNames = useMemo(() => INDIA_LOCATIONS.map((s) => s.name).sort(), []);
  const districtNames = useMemo(
    () => selectedState ? getDistricts(selectedState).map((d) => d.name) : [],
    [selectedState]
  );
  const mandalNames = useMemo(
    () => selectedState && selectedDistrict ? getMandals(selectedState, selectedDistrict) : [],
    [selectedState, selectedDistrict]
  );

  const handleStateChange = (state: string) => {
    onStateChange(state);
    onDistrictChange("");
    onMandalChange("");
  };

  const handleDistrictChange = (district: string) => {
    onDistrictChange(district);
    onMandalChange("");
  };

  return (
    <div className="grid gap-3">
      {label && (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            Select your location {!required && <span className="text-xs opacity-60">(optional)</span>}
          </span>
        </div>
      )}

      <SearchableDropdown
        placeholder="Select State / UT"
        value={selectedState}
        options={stateNames}
        onChange={handleStateChange}
      />

      <SearchableDropdown
        placeholder="Select District"
        value={selectedDistrict}
        options={districtNames}
        onChange={handleDistrictChange}
        disabled={!selectedState}
      />

      <SearchableDropdown
        placeholder="Select Mandal / Sub-division"
        value={selectedMandal}
        options={mandalNames}
        onChange={onMandalChange}
        disabled={!selectedDistrict}
      />
    </div>
  );
}
