import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Running consultant_contracts migration...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS consultant_contracts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      proposal_id varchar NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      consultant text NOT NULL,
      doc_url text NOT NULL,
      generated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS consultant_contracts_proposal_consultant_idx
    ON consultant_contracts(proposal_id, consultant)
  `);

  console.log("consultant_contracts table created (or already existed).");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
