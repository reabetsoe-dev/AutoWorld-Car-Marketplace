const { Pool } = require("pg");

let pool = null;
let connected = false;

const CONNECTION_ERROR_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "53300",
  "57P01",
  "57P02",
  "57P03",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "EPIPE",
  "ETIMEDOUT"
]);

function resolveDatabaseUrl(env = process.env) {
  return env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_CONNECTION_STRING || "";
}

function isPostgresConnectionError(error) {
  const code = error?.code ? String(error.code).toUpperCase() : "";
  if (CONNECTION_ERROR_CODES.has(code)) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return [
    "connection terminated",
    "connection timeout",
    "terminating connection",
    "server closed the connection",
    "connect econnrefused"
  ].some((fragment) => message.includes(fragment));
}

function shouldMarkDatabaseDisconnected(error) {
  return !pool || isPostgresConnectionError(error);
}

function buildPoolConfig(env = process.env) {
  const connectionString = resolveDatabaseUrl(env);
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }

  const sslMode = String(env.PGSSL || env.POSTGRES_SSL || "").trim().toLowerCase();
  const useSsl = ["1", "true", "yes", "require"].includes(sslMode);

  return {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(env.PG_POOL_MAX) || 10,
    idleTimeoutMillis: Number(env.PG_IDLE_TIMEOUT_MS) || 30000,
    connectionTimeoutMillis: Number(env.PG_CONNECTION_TIMEOUT_MS) || 10000
  };
}

function getPool() {
  if (!pool) {
    pool = new Pool(buildPoolConfig());
    pool.on("error", () => {
      connected = false;
    });
  }
  return pool;
}

async function connectDatabase() {
  try {
    const db = getPool();
    await db.query("SELECT 1");
    connected = true;
    return db;
  } catch (error) {
    connected = false;
    throw error;
  }
}

async function query(text, params = []) {
  try {
    const result = await getPool().query(text, params);
    connected = true;
    return result;
  } catch (error) {
    connected = !shouldMarkDatabaseDisconnected(error);
    throw error;
  }
}

async function withTransaction(callback) {
  let client;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    connected = true;
    return result;
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    connected = !shouldMarkDatabaseDisconnected(error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

function isDatabaseConnected() {
  return connected;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  connected = false;
}

module.exports = {
  buildPoolConfig,
  closeDatabase,
  connectDatabase,
  getPool,
  isPostgresConnectionError,
  isDatabaseConnected,
  query,
  resolveDatabaseUrl,
  withTransaction
};
