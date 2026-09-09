import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import prisma from "../config/database";
import fs from "fs";
import path from "path";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

async function main() {
  const defaultPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
  console.log(`Hashing password for all admins...`);
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // Load directory
  const possiblePaths = [
    path.join(__dirname, "../../../frontend/src/data/andhraDirectory.json"),
    path.join(__dirname, "../../frontend/src/data/andhraDirectory.json"),
    path.join(process.cwd(), "frontend/src/data/andhraDirectory.json"),
    path.join(process.cwd(), "src/data/andhraDirectory.json"),
  ];

  let directoryPath = possiblePaths.find((p) => fs.existsSync(p));
  if (!directoryPath) {
    throw new Error("Could not find andhraDirectory.json");
  }

  console.log(`Loading Andhra directory from ${directoryPath}...`);
  const raw = fs.readFileSync(directoryPath, "utf-8");
  const andhra = JSON.parse(raw);

  const districts = [...new Set(andhra.villages.map((v: any) => v.district).filter(Boolean))].sort() as string[];

  const mandalMap = new Map<string, Set<string>>();
  districts.forEach((d) => mandalMap.set(d, new Set<string>()));

  andhra.villages.forEach((v: any) => {
    if (v.district && v.subdistrict) {
      mandalMap.get(v.district)?.add(v.subdistrict);
    }
  });

  const adminUsers: Array<{
    email: string;
    name: string;
    role: string;
    state: string;
    district: string | null;
    mandal: string | null;
    admin_scope: string;
  }> = [];

  // 1. State Admin
  adminUsers.push({
    email: "admin@pothole.gov.in",
    name: "AP State Administrator",
    role: "admin",
    state: "Andhra Pradesh",
    district: null,
    mandal: null,
    admin_scope: "state",
  });

  // 2. District Admins
  for (const district of districts) {
    const dSlug = slugify(district);
    adminUsers.push({
      email: `admin.${dSlug}@pothole.gov.in`,
      name: `${district} District Admin`,
      role: "admin",
      state: "Andhra Pradesh",
      district,
      mandal: null,
      admin_scope: "district",
    });

    // 3. Mandal Admins
    const mandals = [...(mandalMap.get(district) || [])].sort();
    for (const mandal of mandals) {
      const mSlug = slugify(mandal);
      adminUsers.push({
        email: `admin.${mSlug}.${dSlug}@pothole.gov.in`,
        name: `${mandal} Mandal Admin (${district})`,
        role: "admin",
        state: "Andhra Pradesh",
        district,
        mandal,
        admin_scope: "mandal",
      });
    }
  }

  console.log(`Prepared ${adminUsers.length} admin accounts to seed into database...`);

  // Insert in batches of 100 using raw query
  const batchSize = 100;
  for (let i = 0; i < adminUsers.length; i += batchSize) {
    const batch = adminUsers.slice(i, i + batchSize);
    
    // Construct multi-row insert query
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const u of batch) {
      valuePlaceholders.push(
        `(gen_random_uuid(), 'admin'::"Role", $${pIdx}, $${pIdx + 1}, $${pIdx + 2}, 'dark'::"ThemePreference", $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}::"AdminScope", NOW())`
      );
      params.push(u.name, u.email, passwordHash, u.state, u.district, u.mandal, u.admin_scope);
      pIdx += 7;
    }

    const sql = `
      INSERT INTO users (id, role, name, email, password_hash, theme_preference, state, district, mandal, admin_scope, created_at)
      VALUES ${valuePlaceholders.join(", ")}
      ON CONFLICT (email) DO UPDATE SET
        role = EXCLUDED.role,
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        state = EXCLUDED.state,
        district = EXCLUDED.district,
        mandal = EXCLUDED.mandal,
        admin_scope = EXCLUDED.admin_scope;
    `;

    await prisma.$queryRawUnsafe(sql, ...params);
    console.log(`Seeded ${Math.min(i + batchSize, adminUsers.length)} / ${adminUsers.length} admins...`);
  }

  console.log("\n=======================================================");
  console.log(`SUCCESS: All ${adminUsers.length} admin accounts seeded into the database!`);
  console.log(`Default Password: ${defaultPassword}`);
  console.log("=======================================================\n");
}

main()
  .catch((err) => {
    console.error("Error seeding admins:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
