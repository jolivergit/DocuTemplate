import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  const hoursCheck = await db.execute(sql`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'hours_entries' AND column_name = 'invoice_id'
  `);
  const hoursRow = hoursCheck.rows[0] as { is_nullable?: string } | undefined;
  if (hoursRow?.is_nullable === "NO") {
    await db.execute(sql`ALTER TABLE hours_entries ALTER COLUMN invoice_id DROP NOT NULL`);
    console.log("hours_entries.invoice_id set to nullable");
  } else {
    console.log("hours_entries.invoice_id already nullable — skipping");
  }

  const expensesCheck = await db.execute(sql`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'expense_entries' AND column_name = 'invoice_id'
  `);
  const expensesRow = expensesCheck.rows[0] as { is_nullable?: string } | undefined;
  if (expensesRow?.is_nullable === "NO") {
    await db.execute(sql`ALTER TABLE expense_entries ALTER COLUMN invoice_id DROP NOT NULL`);
    console.log("expense_entries.invoice_id set to nullable");
  } else {
    console.log("expense_entries.invoice_id already nullable — skipping");
  }
}

migrate()
  .then(() => {
    console.log("Migration complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
