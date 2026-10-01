const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const runtimeDir = path.join(rootDir, ".local-postgres");
const dataDir = path.join(runtimeDir, "data");
const logFile = path.join(runtimeDir, "postgres.log");
const port = process.env.LOCAL_POSTGRES_PORT || "55432";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensureRuntimeDir() {
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function init() {
  ensureRuntimeDir();
  if (fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("Local PostgreSQL cluster already initialized.");
    return;
  }

  run("initdb", [
    "-D",
    dataDir,
    "-U",
    "postgres",
    "--auth=trust",
    "--encoding=UTF8"
  ]);
}

function start() {
  ensureRuntimeDir();
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    init();
  }

  run("pg_ctl", [
    "-D",
    dataDir,
    "-l",
    logFile,
    "-o",
    `-p ${port} -h 127.0.0.1`,
    "start"
  ]);
}

function stop() {
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("Local PostgreSQL cluster is not initialized.");
    return;
  }

  run("pg_ctl", ["-D", dataDir, "stop", "-m", "fast"]);
}

function status() {
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("Local PostgreSQL cluster is not initialized.");
    process.exit(1);
  }

  run("pg_ctl", ["-D", dataDir, "status"]);
}

const command = process.argv[2] || "status";

if (command === "init") {
  init();
} else if (command === "start") {
  start();
} else if (command === "stop") {
  stop();
} else if (command === "status") {
  status();
} else {
  console.error("Usage: node scripts/localPostgres.js <init|start|stop|status>");
  process.exit(1);
}
