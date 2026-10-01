require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const { closeDatabase, connectDatabase, isDatabaseConnected } = require("./db");

const {
  apiLimiter,
  authLimiter
} = require("./middleware/rateLimiter");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const carRoutes = require("./routes/cars");
const sellRequestRoutes = require("./routes/sellRequests");

const app = express();
app.disable("x-powered-by");

function parseCsvEnv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandLocalhostOrigins(origins) {
  const expandedOrigins = new Set(origins);

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.hostname === "localhost") {
        url.hostname = "127.0.0.1";
        expandedOrigins.add(url.toString().replace(/\/$/, ""));
      } else if (url.hostname === "127.0.0.1") {
        url.hostname = "localhost";
        expandedOrigins.add(url.toString().replace(/\/$/, ""));
      }
    } catch (_error) {
      // Non-URL origins are ignored here and still checked as configured.
    }
  }

  return [...expandedOrigins];
}

function buildCorsOptions() {
  const configuredOrigins = expandLocalhostOrigins(
    parseCsvEnv(process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN || "*")
  );

  if (configuredOrigins.length === 0 || configuredOrigins.includes("*")) {
    return { origin: "*" };
  }

  return {
    origin(origin, callback) {
      if (!origin || configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin is not allowed by CORS."));
    }
  };
}

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api", apiLimiter);
app.use("/api/admin/login", authLimiter);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: isDatabaseConnected() ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/admin", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/sell-requests", sellRequestRoutes);

app.use((err, _req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Image too large (max 8MB)." });
  }
  if (err?.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      message: "Unexpected upload field. Please check the upload field name."
    });
  }
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  if (err) {
    return res.status(500).json({ message: "Unexpected server error." });
  }
  return next();
});

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

async function startServer() {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && !process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET environment variable is missing.");
    }

    try {
      await connectDatabase();
      // eslint-disable-next-line no-console
      console.log(`PostgreSQL connected (${process.env.NODE_ENV || "development"})`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`PostgreSQL unavailable at startup: ${error.message}`);
    }

    const port = Number(process.env.PORT) || 5000;
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`API listening on http://localhost:${port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();

process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  await closeDatabase();

  console.log("PostgreSQL connection closed.");

  process.exit(0);
});
