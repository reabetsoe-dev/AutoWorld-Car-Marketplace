require("dotenv").config();

const { Pool } = require("pg");
const { formatErrorForLog } = require("../src/utils/errorMessages");

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function buildAdminDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }

  const url = new URL(configuredUrl);
  const targetDatabase = url.pathname.replace(/^\/+/, "") || "autoworld";
  url.pathname = "/postgres";

  return {
    adminUrl: url.toString(),
    targetDatabase
  };
}

async function main() {
  const { adminUrl, targetDatabase } = buildAdminDatabaseUrl();
  const sslMode = String(process.env.PGSSL || "").trim().toLowerCase();
  const ssl = ["1", "true", "yes", "require"].includes(sslMode)
    ? { rejectUnauthorized: false }
    : undefined;
  const pool = new Pool({
    connectionString: adminUrl,
    ssl,
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS) || 10000
  });

  try {
    const existing = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetDatabase]
    );

    if (existing.rowCount > 0) {
      console.log(`Database already exists: ${targetDatabase}`);
      return;
    }

    await pool.query(`CREATE DATABASE ${quoteIdentifier(targetDatabase)}`);
    console.log(`Created database: ${targetDatabase}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Database creation failed:", formatErrorForLog(error));
  process.exit(1);
});
