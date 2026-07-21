/**
 * One-off cleanup script for AIContent rows.
 *
 * After the summary field was changed from a plain string to a structured
 * object { hook: string, keyPoints: string[] }, any rows that still have
 * the old string format are invalid. This script:
 *
 *   1. Queries all AIContent rows.
 *   2. For each row, tries JSON.parse(row.summary) and checks the result
 *      has both a `hook` string and a `keyPoints` array.
 *   3. If parsing fails or the shape doesn't match, DELETES that row.
 *   4. Does NOT touch Video.aiContentUnlockedAt — those remain as-is so
 *      the read route can detect the stale unlock and signal regeneration.
 *
 * Run via: npx tsx scripts/cleanup-ai-content.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  const allRows = await db.aIContent.findMany({
    select: { id: true, youtubeVideoId: true, summary: true },
  });

  console.log(`Found ${allRows.length} AIContent rows to check.`);

  let deleted = 0;

  for (const row of allRows) {
    // Skip rows with null summary — no migration needed for empty content
    if (row.summary === null) {
      continue;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(row.summary);
    } catch {
      console.log(`  DELETE ${row.id} (youtubeVideoId: ${row.youtubeVideoId}) — summary is not valid JSON`);
      await db.aIContent.delete({ where: { id: row.id } });
      deleted++;
      continue;
    }

    // Validate shape: { hook: string, keyPoints: string[] }
    const obj = parsed as Record<string, unknown>;
    const hasHook = typeof obj.hook === "string" && obj.hook.length > 0;
    const hasKeyPoints =
      Array.isArray(obj.keyPoints) &&
      obj.keyPoints.length > 0 &&
      obj.keyPoints.every((kp: unknown) => typeof kp === "string");

    if (!hasHook || !hasKeyPoints) {
      console.log(`  DELETE ${row.id} (youtubeVideoId: ${row.youtubeVideoId}) — invalid shape (hook: ${hasHook}, keyPoints: ${hasKeyPoints})`);
      await db.aIContent.delete({ where: { id: row.id } });
      deleted++;
    }
  }

  console.log(`\nDone. Checked ${allRows.length} rows, deleted ${deleted} rows.`);
}

main()
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
