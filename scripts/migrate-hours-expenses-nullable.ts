import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  // ── Make invoice_id nullable on hours_entries ──────────────────────────────
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

  // ── Make invoice_id nullable on expense_entries ────────────────────────────
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

  // ── Ensure FK constraints use ON DELETE SET NULL ───────────────────────────
  // Check and fix hours_entries FK
  const hoursFkCheck = await db.execute(sql`
    SELECT rc.delete_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
    WHERE kcu.table_name = 'hours_entries' AND kcu.column_name = 'invoice_id'
  `);
  const hoursFkRow = hoursFkCheck.rows[0] as { delete_rule?: string } | undefined;
  if (!hoursFkRow || hoursFkRow.delete_rule !== "SET NULL") {
    // Drop existing FK and recreate with ON DELETE SET NULL
    await db.execute(sql`
      DO $$
      DECLARE fk_name text;
      BEGIN
        SELECT tc.constraint_name INTO fk_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'hours_entries'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'invoice_id'
        LIMIT 1;
        IF fk_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE hours_entries DROP CONSTRAINT ' || quote_ident(fk_name);
        END IF;
      END $$;
      ALTER TABLE hours_entries
        ADD CONSTRAINT hours_entries_invoice_id_fk
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
    `);
    console.log("hours_entries FK updated to ON DELETE SET NULL");
  } else {
    console.log("hours_entries FK already ON DELETE SET NULL — skipping");
  }

  // Check and fix expense_entries FK
  const expensesFkCheck = await db.execute(sql`
    SELECT rc.delete_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
    WHERE kcu.table_name = 'expense_entries' AND kcu.column_name = 'invoice_id'
  `);
  const expensesFkRow = expensesFkCheck.rows[0] as { delete_rule?: string } | undefined;
  if (!expensesFkRow || expensesFkRow.delete_rule !== "SET NULL") {
    await db.execute(sql`
      DO $$
      DECLARE fk_name text;
      BEGIN
        SELECT tc.constraint_name INTO fk_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'expense_entries'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'invoice_id'
        LIMIT 1;
        IF fk_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE expense_entries DROP CONSTRAINT ' || quote_ident(fk_name);
        END IF;
      END $$;
      ALTER TABLE expense_entries
        ADD CONSTRAINT expense_entries_invoice_id_fk
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
    `);
    console.log("expense_entries FK updated to ON DELETE SET NULL");
  } else {
    console.log("expense_entries FK already ON DELETE SET NULL — skipping");
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
