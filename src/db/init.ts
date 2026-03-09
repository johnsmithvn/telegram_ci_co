import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "./postgres";
import { logger } from "../logger";

async function main(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
  const sql = await fs.readFile(schemaPath, "utf-8");
  await pool.query(sql);
  logger.info("Database schema initialized");
  await pool.end();
}

main().catch(async (error) => {
  logger.error({ error }, "Database initialization failed");
  await pool.end();
  process.exit(1);
});
