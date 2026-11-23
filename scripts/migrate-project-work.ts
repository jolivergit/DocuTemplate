import { readFile } from "node:fs/promises";
import { pool } from "../server/db";

if (process.env.NODE_ENV === "production" && process.env.CONFIRM_PROJECT_WORK_MIGRATION !== "yes") {
  throw new Error("This migration deletes legacy project notes. Obtain production authorization and explicitly confirm the rollout.");
}
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('studio-project-work-migration'))");
  await client.query(await readFile(new URL("./migrate-project-work.sql", import.meta.url), "utf8"));
  await client.query("COMMIT");
  console.log("Project work schema ready. Legacy project notes retired; proposals and financial history preserved.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
