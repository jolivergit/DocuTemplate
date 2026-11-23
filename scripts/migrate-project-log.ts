import { readFile } from "node:fs/promises";
import { pool } from "../server/db";
if (process.env.NODE_ENV === "production" && process.env.CONFIRM_PROJECT_LOG_MIGRATION !== "yes") {
  throw new Error("Obtain production authorization and confirm the additive project log migration.");
}
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('studio-project-log-migration'))");
  await client.query(await readFile(new URL("./migrate-project-log.sql", import.meta.url), "utf8"));
  await client.query("COMMIT");
  console.log("Project log schema ready; existing task rows and discussions preserved.");
} catch (error) {
  await client.query("ROLLBACK"); throw error;
} finally {
  client.release(); await pool.end();
}
