import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function wipe() {
  console.log("Wiping all tables...");
  // CASCADE handles FK ordering automatically
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "Note", "AIContent", "Video", "Course", "Account", "User" RESTART IDENTITY CASCADE`
  );
  console.log("All data cleared successfully.");
  await db.$disconnect();
}

wipe().catch((e) => {
  console.error("Wipe failed:", e);
  process.exit(1);
});
