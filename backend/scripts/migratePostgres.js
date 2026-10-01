require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { getPool, closeDatabase } = require("../src/db");
const { formatErrorForLog } = require("../src/utils/errorMessages");

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function hasMigrationRun(client, filename) {
  const result = await client.query(
    "SELECT 1 FROM schema_migrations WHERE filename = $1",
    [filename]
  );
  return result.rowCount > 0;
}

async function runMigration(client, filename, sql) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
      [filename]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  const client = await getPool().connect();
  try {
    await ensureMigrationTable(client);

    for (const filename of files) {
      if (await hasMigrationRun(client, filename)) {
        console.log(`Skipping ${filename}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      console.log(`Applying ${filename}`);
      await runMigration(client, filename, sql);
    }

    console.log("PostgreSQL migrations complete.");
  } finally {
    client.release();
    await closeDatabase();
  }
}

main().catch(async (error) => {
  console.error("Migration failed:", formatErrorForLog(error));
  await closeDatabase().catch(() => {});
  process.exit(1);
});
