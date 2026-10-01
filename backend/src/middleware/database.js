const { connectDatabase, isDatabaseConnected } = require("../db");

async function requireDatabaseConnection(_req, res, next) {
  if (!isDatabaseConnected()) {
    try {
      await connectDatabase();
    } catch (_error) {
      return res.status(503).json({
        message: "Database unavailable. Check PostgreSQL connection and DATABASE_URL."
      });
    }
  }

  return next();
}

module.exports = {
  isDatabaseConnected,
  requireDatabaseConnection
};
