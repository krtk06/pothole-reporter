import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import prisma from "../config/database";

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@pothole.gov.in";
  const password = process.env.ADMIN_PASSWORD || "Admin@123456";
  const name = process.env.ADMIN_NAME || "System Administrator";

  console.log(`Setting up admin user: ${email}...`);

  const password_hash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "admin",
        password_hash,
        name,
        state: "Andhra Pradesh",
        admin_scope: "state",
      },
    });
    console.log(`Updated existing user to admin: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        password_hash,
        name,
        role: "admin",
        state: "Andhra Pradesh",
        admin_scope: "state",
        theme_preference: "dark",
      },
    });
    console.log(`Created new admin user: ${email}`);
  }

  console.log("==========================================");
  console.log("Admin credentials successfully configured:");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log("==========================================");
}

main()
  .catch((err) => {
    console.error("Error setting admin user:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
