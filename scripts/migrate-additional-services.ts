import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Running Additional Services migration...");

  // 1. Add proposal_type column to proposals (idempotent)
  const proposalTypeCols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'proposal_type'
  `);
  if ((proposalTypeCols.rows as { column_name: string }[]).length === 0) {
    await db.execute(sql`
      ALTER TABLE proposals ADD COLUMN proposal_type text NOT NULL DEFAULT 'Standard'
    `);
    console.log("  ✓ Added proposal_type column to proposals");
  } else {
    console.log("  ⟳ proposal_type column already exists, skipping");
  }

  // 2. Create proposal_additional_line_items table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS proposal_additional_line_items (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      proposal_id varchar NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      description text NOT NULL,
      amount numeric(12, 2),
      sort_order integer NOT NULL DEFAULT 0
    )
  `);
  console.log("  ✓ Ensured proposal_additional_line_items table");

  // 3. Create invoice_additional_line_item_snapshots table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invoice_additional_line_item_snapshots (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id varchar NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      additional_line_item_id varchar NOT NULL,
      description text NOT NULL,
      amount numeric(12, 2),
      percent_complete numeric(5, 2),
      previous_billing numeric(12, 2),
      current_billing numeric(12, 2),
      sort_order integer NOT NULL DEFAULT 0
    )
  `);
  console.log("  ✓ Ensured invoice_additional_line_item_snapshots table");

  console.log("Additional Services migration complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
