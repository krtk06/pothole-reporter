import directory from "./andhraDirectory.json";
import type { AdministrativeArea } from "@/types";

type AndhraVillageRecord = {
  villageCode: string;
  village: string;
  subdistrictCode: string;
  subdistrict: string;
  districtCode: string;
  district: string;
};

const MAX_RESULTS = 30;

export const ANDHRA_STATE = {
  code: "28",
  name: "Andhra Pradesh",
  bbox: { north: 19.9, south: 12.6, east: 84.8, west: 76.7 },
};

export const ANDHRA_VILLAGES = (directory.villages as AndhraVillageRecord[]).filter((record) =>
  record.villageCode &&
  record.village &&
  record.subdistrictCode &&
  record.subdistrict &&
  record.districtCode &&
  record.district
);

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function asArea(record: {
  id: string;
  name: string;
  type: "district" | "subdistrict" | "village";
  districtCode?: string;
  districtName?: string;
  subdistrictCode?: string;
  subdistrictName?: string;
}): AdministrativeArea {
  return {
    id: record.id,
    name: record.name,
    displayName: [
      record.name,
      record.type === "village" ? record.subdistrictName : null,
      record.type !== "district" ? record.districtName : null,
      ANDHRA_STATE.name,
      "India",
    ].filter(Boolean).join(", "),
    type: record.type,
    stateCode: ANDHRA_STATE.code,
    stateName: ANDHRA_STATE.name,
    districtCode: record.districtCode,
    districtName: record.districtName,
    subdistrictCode: record.subdistrictCode,
    subdistrictName: record.subdistrictName,
  };
}

function sortAndLimit(areas: AdministrativeArea[], query: string): AdministrativeArea[] {
  const normalizedQuery = normalize(query);
  return areas
    .filter((area) => !normalizedQuery || normalize(area.name).startsWith(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_RESULTS);
}

export function getFallbackDistricts(query = ""): AdministrativeArea[] {
  const districts = new Map<string, AdministrativeArea>();
  for (const record of ANDHRA_VILLAGES) {
    districts.set(record.districtCode, asArea({
      id: `district:${record.districtCode}`,
      name: record.district,
      type: "district",
      districtCode: record.districtCode,
      districtName: record.district,
    }));
  }
  return sortAndLimit([...districts.values()], query);
}

export function getFallbackSubdistricts(districtCode: string, query = ""): AdministrativeArea[] {
  const subdistricts = new Map<string, AdministrativeArea>();
  for (const record of ANDHRA_VILLAGES) {
    if (record.districtCode !== districtCode) continue;
    subdistricts.set(record.subdistrictCode, asArea({
      id: `subdistrict:${record.subdistrictCode}`,
      name: record.subdistrict,
      type: "subdistrict",
      districtCode: record.districtCode,
      districtName: record.district,
      subdistrictCode: record.subdistrictCode,
      subdistrictName: record.subdistrict,
    }));
  }
  return sortAndLimit([...subdistricts.values()], query);
}

export function getFallbackVillages(districtCode: string, subdistrictCode: string, query = ""): AdministrativeArea[] {
  const villages = new Map<string, AdministrativeArea>();
  for (const record of ANDHRA_VILLAGES) {
    if (record.districtCode !== districtCode || record.subdistrictCode !== subdistrictCode) continue;
    villages.set(record.villageCode, asArea({
      id: `village:${record.villageCode}`,
      name: record.village,
      type: "village",
      districtCode: record.districtCode,
      districtName: record.district,
      subdistrictCode: record.subdistrictCode,
      subdistrictName: record.subdistrict,
    }));
  }
  return sortAndLimit([...villages.values()], query);
}
