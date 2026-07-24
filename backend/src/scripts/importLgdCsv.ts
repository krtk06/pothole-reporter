import fs from "fs";
import path from "path";
import prisma from "../config/database";

type VillageRecord = {
  villageCode: string;
  village: string;
  subdistrictCode: string;
  subdistrict: string;
  districtCode: string;
  district: string;
};

const STATE_CODE = "28";
const STATE_NAME = "Andhra Pradesh";
const SOURCE = "LGD administrative directory";
const BATCH_SIZE = 500;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function clean(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers = [], ...data] = rows;
  const normalizedHeaders = headers.map((header) => normalizeName(header).replace(/[^a-z0-9]/g, ""));
  return data
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ""])));
}

function fromUnknownRecord(record: Record<string, any>): VillageRecord {
  return {
    villageCode: clean(record.villageCode ?? record.villagecode ?? record.lgd_villagecode ?? record.lgdvillagecode),
    village: clean(record.village ?? record.name ?? record.lgd_villagename ?? record.lgdvillagename),
    subdistrictCode: clean(record.subdistrictCode ?? record.subdistrictcode ?? record.lgd_subdistrictcode ?? record.lgdsubdistrictcode),
    subdistrict: clean(record.subdistrict ?? record.mandal ?? record.subdistrictname),
    districtCode: clean(record.districtCode ?? record.districtcode ?? record.lgd_districtcode ?? record.lgddistrictcode),
    district: clean(record.district ?? record.districtname),
  };
}

function readInput(filePath: string): VillageRecord[] {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  if (filePath.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    const villages = Array.isArray(parsed) ? parsed : parsed.villages;
    if (!Array.isArray(villages)) {
      throw new Error("JSON input must be an array or contain a villages array");
    }
    return villages.map(fromUnknownRecord);
  }

  return parseCsv(text).map(fromUnknownRecord);
}

function validateAndDedupe(records: VillageRecord[]): VillageRecord[] {
  const byVillageCode = new Map<string, VillageRecord>();
  for (const record of records) {
    if (!record.villageCode || !record.village || !record.subdistrictCode || !record.subdistrict || !record.districtCode || !record.district) {
      throw new Error(`Invalid LGD record: ${JSON.stringify(record)}`);
    }
    byVillageCode.set(record.villageCode, record);
  }
  return [...byVillageCode.values()].sort((a, b) =>
    a.district.localeCompare(b.district) ||
    a.subdistrict.localeCompare(b.subdistrict) ||
    a.village.localeCompare(b.village)
  );
}

function buildAreas(villages: VillageRecord[]) {
  const areas = new Map<string, any>();

  areas.set(`state:${STATE_CODE}`, {
    id: `state:${STATE_CODE}`,
    name: STATE_NAME,
    level: "state",
    state_code: STATE_CODE,
    state_name: STATE_NAME,
    district_code: null,
    district_name: null,
    subdistrict_code: null,
    subdistrict_name: null,
  });

  for (const village of villages) {
    areas.set(`district:${village.districtCode}`, {
      id: `district:${village.districtCode}`,
      name: village.district,
      level: "district",
      state_code: STATE_CODE,
      state_name: STATE_NAME,
      district_code: village.districtCode,
      district_name: village.district,
      subdistrict_code: null,
      subdistrict_name: null,
    });

    areas.set(`subdistrict:${village.subdistrictCode}`, {
      id: `subdistrict:${village.subdistrictCode}`,
      name: village.subdistrict,
      level: "subdistrict",
      state_code: STATE_CODE,
      state_name: STATE_NAME,
      district_code: village.districtCode,
      district_name: village.district,
      subdistrict_code: village.subdistrictCode,
      subdistrict_name: village.subdistrict,
    });

    areas.set(`village:${village.villageCode}`, {
      id: `village:${village.villageCode}`,
      name: village.village,
      level: "village",
      state_code: STATE_CODE,
      state_name: STATE_NAME,
      district_code: village.districtCode,
      district_name: village.district,
      subdistrict_code: village.subdistrictCode,
      subdistrict_name: village.subdistrict,
    });
  }

  return [...areas.values()];
}

async function upsertBatch(areas: any[]) {
  if (areas.length === 0) return;

  const placeholders: string[] = [];
  const params: any[] = [];
  areas.forEach((area, index) => {
    const base = index * 11;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`);
    params.push(
      area.id,
      area.name,
      normalizeName(area.name),
      area.level,
      area.state_code,
      area.state_name,
      area.district_code,
      area.district_name,
      area.subdistrict_code,
      area.subdistrict_name,
      SOURCE
    );
  });

  await prisma.$executeRawUnsafe(`
    INSERT INTO administrative_areas (
      id, name, normalized_name, level, state_code, state_name,
      district_code, district_name, subdistrict_code, subdistrict_name, source
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      normalized_name = EXCLUDED.normalized_name,
      level = EXCLUDED.level,
      state_code = EXCLUDED.state_code,
      state_name = EXCLUDED.state_name,
      district_code = EXCLUDED.district_code,
      district_name = EXCLUDED.district_name,
      subdistrict_code = EXCLUDED.subdistrict_code,
      subdistrict_name = EXCLUDED.subdistrict_name,
      source = EXCLUDED.source,
      updated_at = CURRENT_TIMESTAMP
  `, ...params);
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: tsx src/scripts/importLgdCsv.ts <andhraDirectory.json|lgd.csv>");
  }

  const resolved = path.resolve(inputPath);
  const villages = validateAndDedupe(readInput(resolved));
  const areas = buildAreas(villages);

  for (let index = 0; index < areas.length; index += BATCH_SIZE) {
    await upsertBatch(areas.slice(index, index + BATCH_SIZE));
    process.stdout.write(`Imported ${Math.min(index + BATCH_SIZE, areas.length)} / ${areas.length}\r`);
  }

  process.stdout.write("\n");
  console.log(`Imported ${villages.length} villages and ${areas.length} administrative areas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
