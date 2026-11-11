import { readFile } from "node:fs/promises";
import { pool } from "../server/db";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(await readFile(new URL("./migrate-workspaces.sql", import.meta.url), "utf8"));
  const checks = await client.query(`SELECT
    (SELECT count(*) FROM leads WHERE workspace_id IS NULL) AS orphan_projects,
    (SELECT count(*) FROM companies WHERE workspace_id IS NULL) AS orphan_companies,
    (SELECT count(*) FROM contacts WHERE workspace_id IS NULL) AS orphan_contacts`);
  if (Object.values(checks.rows[0]).some(value => Number(value) !== 0)) throw new Error("Migration completeness check failed");
  await client.query("COMMIT");
  console.log("Workspace migration completed; all existing records have a workspace.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
