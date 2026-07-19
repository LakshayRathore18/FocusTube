import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Prevent multiple Prisma client instances during Next.js hot-reload in dev.
// In production, each serverless function invocation gets one fresh instance.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL!;

  // Suppress the pg-connection-string SECURITY WARNING:
  //   sslmode=prefer|require|verify-ca are aliased to verify-full.
  // Replace any existing weak sslmode with verify-full, or append it.
  const connectionString = rawUrl.includes("sslmode=")
    ? rawUrl.replace(/sslmode=\w+/g, "sslmode=verify-full")
    : rawUrl + (rawUrl.includes("?") ? "&" : "?") + "sslmode=verify-full";

  const pool = new Pool({ connectionString });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
