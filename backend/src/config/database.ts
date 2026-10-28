import dotenv from "dotenv";

// Load .env before the AWS-only database guard reads DATABASE_URL.
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { assertAwsDatabase } from "./databaseTarget";

// Fail before opening a connection if the target is not AWS RDS. Tests mock
// this module, so they never need a real database.
if (process.env.NODE_ENV !== "test") {
  assertAwsDatabase(process.env.DATABASE_URL);
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
});

export default prisma;
