const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/RefreshToken");
const { normalizeRole } = require("../constants/roles");

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

function signAccessToken(adminUser) {
  const payload = {
    id: adminUser._id.toString(),
    role: normalizeRole(adminUser.role),
    username: adminUser.username,
    name: adminUser.name,
    tokenType: "access"
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET || "development-only-secret",
    { expiresIn: accessTokenExpiry() }
  );
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

  const persisted = await RefreshToken.create({
    tokenHash,
    adminUser: adminUserId,
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
  return RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    {
      revokedAt: now(),
      replacedByTokenHash
    },
    { new: true }
  );
}

module.exports = {
  hashToken,
  signAccessToken,
  createRefreshToken,
  revokeRefreshToken
};
