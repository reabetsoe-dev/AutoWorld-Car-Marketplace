require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const carRoutes = require("./routes/cars");

const app = express();

function parseCsvEnv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCorsOptions() {
  const configuredOrigins = parseCsvEnv(
    process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN || "*"
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
  cors(buildCorsOptions())
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/admin", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cars", carRoutes);

app.use((err, _req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Image too large (max 5MB)." });
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
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/autoworld";

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS) || 10000
    });
    // eslint-disable-next-line no-console
    console.log("MongoDB connected");

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
