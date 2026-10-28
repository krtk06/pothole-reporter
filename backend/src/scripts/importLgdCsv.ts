import fs from "fs";
import path from "path";
import readline from "readline";
import prisma from "../config/database";

type AreaLevel = "state" | "district" | "subdistrict" | "village";

interface DirectoryRecord {
  id: string;
  name: string;
  normalizedName: string;
  level: AreaLevel;
  stateCode: string | null;
  stateName: string | null;
  districtCode: string | null;
  districtName: string | null;
  subdistrictCode: string | null;
  subdistrictName: string | null;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function normaliseHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normaliseName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function readField(row: string[], columns: Map<string, number>, aliases: string[]) {
  for (const alias of aliases) {
    const column = columns.get(alias);
    if (column !== undefined && row[column]) return row[column].trim();
  }
  return "";
}

function recordFromRow(level: AreaLevel, row: string[], columns: Map<string, number>): DirectoryRecord | null {
  const stateCode = readField(row, columns, ["statecode", "statelgd"]);
  const stateName = readField(row, columns, ["statenameenglish", "statename", "state"]);
  const districtCode = readField(row, columns, ["districtcode", "districtlgd"]);
  const districtName = readField(row, columns, ["districtnameenglish", "districtname", "district"]);
  const subdistrictCode = readField(row, columns, ["subdistrictcode", "subdistrictlgd", "subdistrictcode", "tehsilcode"]);
  const subdistrictName = readField(row, columns, ["subdistrictnameenglish", "subdistrictname", "subdistrict", "tehsilname"]);
  const code = level === "state" ? stateCode : level === "district" ? districtCode : level === "subdistrict" ? subdistrictCode : readField(row, columns, ["villagecode", "villagelgd"]);
  const name = level === "state" ? stateName : level === "district" ? districtName : level === "subdistrict" ? subdistrictName : readField(row, columns, ["villagenameenglish", "villagename", "village"]);
  if (!code || !name) return null;
  return {
    id: `lgd:${level}:${code}`,
    name,
    normalizedName: normaliseName(name),
    level,
    stateCode: stateCode || null,
    stateName: stateName || null,
    districtCode: districtCode || null,
    districtName: districtName || null,
    subdistrictCode: subdistrictCode || null,
    subdistrictName: subdistrictName || null,
  };
}

async function flush(records: DirectoryRecord[]) {
  if (!records.length) return;
  const values: unknown[] = [];
  const placeholders = records.map((record, recordIndex) => {
    const offset = recordIndex * 10;
    values.push(record.id, record.name, record.normalizedName, record.level, record.stateCode, record.stateName, record.districtCode, record.districtName, record.subdistrictCode, record.subdistrictName);
    return `(${Array.from({ length: 10 }, (_, index) => `$${offset + index + 1}`).join(", ")})`;
  });
  await prisma.$executeRawUnsafe(
    `INSERT INTO administrative_areas (id, name, normalized_name, level, state_code, state_name, district_code, district_name, subdistrict_code, subdistrict_name)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       normalized_name = EXCLUDED.normalized_name,
       state_code = EXCLUDED.state_code,
       state_name = EXCLUDED.state_name,
       district_code = EXCLUDED.district_code,
       district_name = EXCLUDED.district_name,
       subdistrict_code = EXCLUDED.subdistrict_code,
       subdistrict_name = EXCLUDED.subdistrict_name,
       updated_at = CURRENT_TIMESTAMP`,
    ...values,
  );
}

async function importFile(level: AreaLevel, filePath: string) {
  const source = readline.createInterface({ input: fs.createReadStream(filePath, { encoding: "utf8" }), crlfDelay: Infinity });
  let columns: Map<string, number> | null = null;
  let records: DirectoryRecord[] = [];
  let imported = 0;
  for await (const line of source) {
    if (!line.trim()) continue;
    if (!columns) {
      columns = new Map(parseCsvLine(line).map((header, index) => [normaliseHeader(header.replace(/^\uFEFF/, "")), index]));
      continue;
    }
    const record = recordFromRow(level, parseCsvLine(line), columns);
    if (!record) continue;
    if (stateFilter && normaliseName(record.stateName || "") !== stateFilter) continue;
    records.push(record);
    if (records.length === 250) {
      await flush(records);
      imported += records.length;
      records = [];
    }
  }
  await flush(records);
  imported += records.length;
  console.log(`Imported ${imported.toLocaleString()} ${level} rows from ${path.basename(filePath)}`);
}

const files = process.argv.slice(2);
const stateFilter = process.env.LGD_STATE_FILTER ? normaliseName(process.env.LGD_STATE_FILTER) : null;
const levelFromFileName = (filePath: string): AreaLevel | null => {
  const name = path.basename(filePath).toLocaleLowerCase();
  if (name.includes("village")) return "village";
  if (name.includes("subdistrict") || name.includes("sub_district") || name.includes("mandal")) return "subdistrict";
  if (name.includes("district")) return "district";
  if (name.includes("state")) return "state";
  return null;
};

async function main() {
  if (!files.length) throw new Error("Pass LGD CSV files: states, districts, subdistricts, villages.");
  for (const filePath of files) {
    const level = levelFromFileName(filePath);
    if (!level) throw new Error(`Cannot infer LGD level from ${filePath}`);
    await importFile(level, filePath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
