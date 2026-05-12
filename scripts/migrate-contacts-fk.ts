/**
 * Migration: contacts-fk
 * 1. For every lead_companies row that has contact_full_name but no contact_id,
 *    upsert a contacts record and backfill contact_id.
 * 2. Drop the four inline columns: contact_full_name, contact_title,
 *    contact_phone, contact_email.
 *
 * Run with: npx tsx scripts/migrate-contacts-fk.ts
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("Starting migration: contacts-fk");

  // Step 1: Find all lead_companies rows with contact_full_name but no contact_id.
  // We use raw SQL because these columns may not exist in the Drizzle schema anymore.
  const { rows: orphanRows } = await pool.query<{
    id: string;
    lead_id: number;
    contact_full_name: string | null;
    contact_title: string | null;
    contact_phone: string | null;
    contact_email: string | null;
  }>(
    `SELECT id, lead_id, contact_full_name, contact_title, contact_phone, contact_email
     FROM lead_companies
     WHERE contact_id IS NULL
       AND contact_full_name IS NOT NULL AND contact_full_name <> ''`
  );

  console.log(`Found ${orphanRows.length} lead_company rows without contactId.`);

  if (orphanRows.length > 0) {
    const leadIds = Array.from(new Set(orphanRows.map((r) => r.lead_id)));
    const { rows: leadRows } = await pool.query<{ id: number; user_id: string }>(
      `SELECT id, user_id FROM leads WHERE id = ANY($1)`,
      [leadIds]
    );
    const leadUserMap = new Map(leadRows.map((l) => [l.id, l.user_id]));

    // Cache: `${userId}::${lowerEmail}` → contactId
    const contactCache = new Map<string, string>();

    for (const row of orphanRows) {
      const userId = leadUserMap.get(row.lead_id);
      if (!userId) continue;

      let contactId: string | null = null;

      // Try to match by email first
      if (row.contact_email) {
        const cacheKey = `${userId}::${row.contact_email.toLowerCase()}`;
        if (contactCache.has(cacheKey)) {
          contactId = contactCache.get(cacheKey)!;
        } else {
          const { rows: existing } = await pool.query<{ id: string }>(
            `SELECT id FROM contacts WHERE user_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
            [userId, row.contact_email]
          );
          if (existing.length > 0) {
            contactId = existing[0].id;
            contactCache.set(cacheKey, contactId);
          }
        }
      }

      // If not found by email, create a new contact
      if (!contactId) {
        const newId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO contacts (id, user_id, full_name, title, phone, email)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newId, userId, row.contact_full_name, row.contact_title || null, row.contact_phone || null, row.contact_email || null]
        );
        contactId = newId;
        console.log(`  Created contact: ${row.contact_full_name}`);
        if (row.contact_email) {
          contactCache.set(`${userId}::${row.contact_email.toLowerCase()}`, contactId);
        }
      }

      await pool.query(`UPDATE lead_companies SET contact_id = $1 WHERE id = $2`, [contactId, row.id]);
    }

    console.log("  contactId backfill complete.");
  }

  // Step 2: Drop the four inline columns (IF EXISTS makes this idempotent)
  console.log("Dropping inline columns from lead_companies...");
  await pool.query(`
    ALTER TABLE lead_companies
      DROP COLUMN IF EXISTS contact_full_name,
      DROP COLUMN IF EXISTS contact_title,
      DROP COLUMN IF EXISTS contact_phone,
      DROP COLUMN IF EXISTS contact_email;
  `);

  console.log("Migration complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
