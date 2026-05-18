/**
 * Migration: Proposal Consultants Restructure
 *
 * - proposal_fee_lines: replace service_category + discipline columns with a single consultant column
 * - invoice_fee_line_snapshots: same replacement
 *
 * Discipline mapping:
 *   "Interior Design" → "Interior Design"
 *   "MEP & FP"        → "MEP Engineering"
 *   "Structural"      → "Structural Engineering"
 *   (anything else)   → kept as-is
 *
 * Fully idempotent — checks column existence before altering.
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `);
  return result.rows.length > 0;
}

async function migrate() {
  console.log("Starting proposal consultant migration...");

  // ── proposal_fee_lines ──────────────────────────────────────────────────────
  const feeLineHasConsultant = await columnExists("proposal_fee_lines", "consultant");
  if (!feeLineHasConsultant) {
    console.log("  Adding consultant column to proposal_fee_lines...");
    await db.execute(sql`ALTER TABLE proposal_fee_lines ADD COLUMN consultant text`);

    console.log("  Backfilling from discipline...");
    await db.execute(sql`
      UPDATE proposal_fee_lines SET consultant = CASE
        WHEN discipline = 'Interior Design' THEN 'Interior Design'
        WHEN discipline = 'MEP & FP'        THEN 'MEP Engineering'
        WHEN discipline = 'Structural'      THEN 'Structural Engineering'
        ELSE discipline
      END
    `);

    await db.execute(sql`
      UPDATE proposal_fee_lines SET consultant = 'Interior Design' WHERE consultant IS NULL
    `);
    await db.execute(sql`
      ALTER TABLE proposal_fee_lines ALTER COLUMN consultant SET NOT NULL
    `);

    console.log("  Dropping old columns from proposal_fee_lines...");
    await db.execute(sql`ALTER TABLE proposal_fee_lines DROP COLUMN IF EXISTS service_category`);
    await db.execute(sql`ALTER TABLE proposal_fee_lines DROP COLUMN IF EXISTS discipline`);
    console.log("  proposal_fee_lines done.");
  } else {
    console.log("  proposal_fee_lines already migrated — skipping.");
    // Still clean up old columns if they still exist
    await db.execute(sql`ALTER TABLE proposal_fee_lines DROP COLUMN IF EXISTS service_category`);
    await db.execute(sql`ALTER TABLE proposal_fee_lines DROP COLUMN IF EXISTS discipline`);
  }

  // ── invoice_fee_line_snapshots ──────────────────────────────────────────────
  const snapshotHasConsultant = await columnExists("invoice_fee_line_snapshots", "consultant");
  if (!snapshotHasConsultant) {
    console.log("  Adding consultant column to invoice_fee_line_snapshots...");
    await db.execute(sql`ALTER TABLE invoice_fee_line_snapshots ADD COLUMN consultant text`);

    console.log("  Backfilling from discipline...");
    await db.execute(sql`
      UPDATE invoice_fee_line_snapshots SET consultant = CASE
        WHEN discipline = 'Interior Design' THEN 'Interior Design'
        WHEN discipline = 'MEP & FP'        THEN 'MEP Engineering'
        WHEN discipline = 'Structural'      THEN 'Structural Engineering'
        ELSE discipline
      END
    `);

    await db.execute(sql`
      UPDATE invoice_fee_line_snapshots SET consultant = 'Interior Design' WHERE consultant IS NULL
    `);
    await db.execute(sql`
      ALTER TABLE invoice_fee_line_snapshots ALTER COLUMN consultant SET NOT NULL
    `);

    console.log("  Dropping old columns from invoice_fee_line_snapshots...");
    await db.execute(sql`ALTER TABLE invoice_fee_line_snapshots DROP COLUMN IF EXISTS service_category`);
    await db.execute(sql`ALTER TABLE invoice_fee_line_snapshots DROP COLUMN IF EXISTS discipline`);
    console.log("  invoice_fee_line_snapshots done.");
  } else {
    console.log("  invoice_fee_line_snapshots already migrated — skipping.");
    await db.execute(sql`ALTER TABLE invoice_fee_line_snapshots DROP COLUMN IF EXISTS service_category`);
    await db.execute(sql`ALTER TABLE invoice_fee_line_snapshots DROP COLUMN IF EXISTS discipline`);
  }

  console.log("Migration complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
