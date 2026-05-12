/**
 * Cleanup script — removes all seeded companies, contacts, and leads for the first user.
 * Cascades handle proposals, invoices, fee lines, expenses, hours, comments, etc.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../shared/schema";
import { eq } from "drizzle-orm";

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

async function main() {
  const [user] = await db.select().from(schema.users).limit(1);
  if (!user) { console.error("No user found"); process.exit(1); }
  const userId = user.id;
  console.log(`Cleaning up for: ${user.email}`);

  // Count before
  const companiesBefore = await db.select().from(schema.companies).where(eq(schema.companies.userId, userId));
  const contactsBefore  = await db.select().from(schema.contacts).where(eq(schema.contacts.userId, userId));
  const leadsBefore     = await db.select().from(schema.leads).where(eq(schema.leads.userId, userId));
  console.log(`Before — companies: ${companiesBefore.length}, contacts: ${contactsBefore.length}, leads: ${leadsBefore.length}`);

  // Delete in dependency order (cascades handle child records)
  await db.delete(schema.leads).where(eq(schema.leads.userId, userId));
  await db.delete(schema.contacts).where(eq(schema.contacts.userId, userId));
  await db.delete(schema.companies).where(eq(schema.companies.userId, userId));

  console.log("All seeded data removed.");
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
