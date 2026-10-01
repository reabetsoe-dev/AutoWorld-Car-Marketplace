const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { normalizeRole } = require("../constants/roles");
const {
  createRefreshTokenRecord,
  revokeRefreshTokenByHash
} = require("../repositories/refreshTokens");

function now() {
  return new Date();
}

function accessTokenExpiry() {
  return process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "15m";
}

function refreshTokenDays() {
  const parsed = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function refreshTokenBytes() {
  const parsed = Number(process.env.REFRESH_TOKEN_BYTES || 48);
  return Number.isFinite(parsed) && parsed >= 32 ? parsed : 48;
}

function hashToken(tokenValue) {
  return crypto.createHash("sha256").update(tokenValue).digest("hex");
}

function generateRefreshTokenValue() {
  return crypto.randomBytes(refreshTokenBytes()).toString("hex");
}

function getJwtSecret() {
  const configuredSecret = process.env.JWT_SECRET;

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production.");
  }

  return "development-only-secret";
}

function signAccessToken(adminUser) {
  const payload = {
    id: String(adminUser._id || adminUser.id),
    role: normalizeRole(adminUser.role),
    username: adminUser.username,
    name: adminUser.name,
    tokenType: "access"
  };

  return jwt.sign(payload, getJwtSecret(), { expiresIn: accessTokenExpiry() });
}

function refreshTokenExpiryDate() {
  const expires = now();
  expires.setDate(expires.getDate() + refreshTokenDays());
  return expires;
}

async function createRefreshToken({ adminUserId, ipAddress }) {
  const refreshToken = generateRefreshTokenValue();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = refreshTokenExpiryDate();

  const persisted = await createRefreshTokenRecord({
    tokenHash,
    adminUserId,
    expiresAt,
    createdByIp: ipAddress || null
  });

  return {
    refreshToken,
    tokenHash,
    expiresAt,
    persisted
  };
}

async function revokeRefreshToken({ tokenHash, replacedByTokenHash = null }) {
  return revokeRefreshTokenByHash(tokenHash, replacedByTokenHash);
}

module.exports = {
  hashToken,
  getJwtSecret,
  signAccessToken,
  createRefreshToken,
  revokeRefreshToken
};
