import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: connection URL lives here, not in schema.prisma
// dotenv/config loads .env.local automatically when running prisma CLI commands
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
