import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import prisma from "../config/database";

type RosterRow = {
  email: string;
  name: string;
  role?: string;
  state?: string;
  district?: string;
  mandal?: string;
  admin_scope?: string;
};

const SCOPE_MAP: Record<string, "state" | "district" | "mandal"> = {
  "Admin-city": "state",
  Admin_District: "district",
  "Admin-Mandal": "mandal",
};

function findRoster(explicit?: string): string {
  const candidates = [
    explicit,
    path.resolve(__dirname, "../../../admin-roster.json"),
    path.resolve(process.cwd(), "../admin-roster.json"),
    path.resolve(process.cwd(), "admin-roster.json"),
  ].filter((value): value is string => Boolean(value));
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Could not find admin-roster.json. Pass --file=/path/to/admin-roster.json");
  return found;
}

function normalize(value?: string): string | null {
  const trimmed = (value || "").trim();
  return trimmed || null;
}

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD is required and must be at least 12 characters. " +
        "This script never prints or stores the password.",
    );
  }

  const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
  const updateScope = process.argv.includes("--update-scope");
  const rosterPath = findRoster(fileArg?.slice("--file=".length));
  const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8")) as RosterRow[];
  if (!Array.isArray(roster) || roster.length === 0) throw new Error("Roster is empty");

  const passwordHash = await bcrypt.hash(password, 12);
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const row of roster) {
    const email = (row.email || "").trim().toLowerCase();
    if (!email) continue;
    const scope = SCOPE_MAP[row.admin_scope || ""] || null;
    if (!scope) throw new Error(`Unknown admin_scope for ${email}: ${row.admin_scope}`);

    const state = normalize(row.state);
    const district = normalize(row.district);
    const mandal = normalize(row.mandal);

    if (scope === "district" && (!state || !district)) {
      throw new Error(`District admin ${email} is missing state/district`);
    }
    if (scope === "mandal" && (!state || !district || !mandal)) {
      throw new Error(`Mandal admin ${email} is missing state/district/mandal`);
    }

    const result = await prisma.$executeRawUnsafe(
      `INSERT INTO users (
         id, role, name, email, password_hash, theme_preference,
         state, district, locality, admin_scope, session_version, created_at
       )
       VALUES (
         gen_random_uuid(), 'admin'::"Role", $1, $2, $3, 'dark'::"ThemePreference",
         $4, $5, $6, $7, 0, NOW()
       )
       ON CONFLICT (email) DO ${
         updateScope
           ? `UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state,
                district = EXCLUDED.district, locality = EXCLUDED.locality,
                admin_scope = EXCLUDED.admin_scope`
           : "NOTHING"
       }`,
      row.name || email,
      email,
      passwordHash,
      state,
      district,
      mandal,
      scope,
    );

    // $executeRawUnsafe returns affected rows; ON CONFLICT DO NOTHING is 0.
    if (result === 0) skipped++;
    else if (updateScope) updated++;
    else created++;
  }

  console.log(
    `Admin roster processed: ${created} created, ${skipped} existing left untouched, ${updated} scope-updated. ` +
      "Passwords for existing accounts were not changed.",
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
