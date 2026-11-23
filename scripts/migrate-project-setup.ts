import { readFile } from "node:fs/promises";
import { pool } from "../server/db";
if (process.env.NODE_ENV === "production" && process.env.CONFIRM_PROJECT_SETUP_MIGRATION !== "yes") {
  throw new Error("Obtain production rollout authorization and confirm this additive project setup migration.");
}
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('studio-project-setup-migration'))");
  await client.query(await readFile(new URL("./migrate-project-setup.sql", import.meta.url), "utf8"));
  await client.query("COMMIT");
  console.log("Project setup schema ready; legacy assignments preserved without inferred roles.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
