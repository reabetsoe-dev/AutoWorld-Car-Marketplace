const express = require("express");
const bcrypt = require("bcryptjs");
const { requireAdminAuth } = require("../middleware/auth");
const { requireDatabaseConnection } = require("../middleware/database");
const { normalizeRole } = require("../constants/roles");
const {
  hashToken,
  signAccessToken,
  createRefreshToken,
  revokeRefreshToken
} = require("../utils/tokens");
const { recordAudit } = require("../utils/audit");
const {
  findAdminById,
  findAdminByUsername,
  updateAdminUser
} = require("../repositories/adminUsers");
const {
  findRefreshTokenByHash,
  markRefreshTokenLastUsed,
  revokeRefreshTokenById,
  revokeRefreshTokensForAdmin
} = require("../repositories/refreshTokens");

const router = express.Router();

const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const ACCOUNT_LOCK_MINUTES = Number(process.env.ACCOUNT_LOCK_MINUTES) || 15;

function sanitizeAdmin(admin) {
  return {
    id: admin._id,
    username: admin.username,
    email: admin.email,
    name: admin.name,
    role: normalizeRole(admin.role),
    isActive: Boolean(admin.isActive),
    lastLogin: admin.lastLogin || null
  };
}

function accessTokenInfo() {
  return process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "15m";
}

function resolveIpAddress(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const first = String(forwardedFor).split(",")[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || null;
}

router.post("/login", requireDatabaseConnection, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required." });
    }

    const admin = await findAdminByUsername(username);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (admin.lockUntil && admin.lockUntil > new Date()) {
      return res.status(423).json({
        message: "Your account is temporarily locked.",
        lockedUntil: admin.lockUntil
      });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);

    if (!passwordMatches) {
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;

      if (admin.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        admin.lockUntil = new Date(Date.now() + ACCOUNT_LOCK_MINUTES * 60 * 1000);
      }

      await updateAdminUser(admin._id, {
        failedLoginAttempts: admin.failedLoginAttempts,
        lockUntil: admin.lockUntil
      });

      return res.status(401).json({
        message: "Invalid credentials."
      });
    }

    const updatedAdmin = await updateAdminUser(admin._id, {
      lastLogin: new Date(),
      failedLoginAttempts: 0,
      lockUntil: null
    });

    const accessToken = signAccessToken(updatedAdmin);
    const refresh = await createRefreshToken({
      adminUserId: updatedAdmin._id,
      ipAddress: resolveIpAddress(req)
    });

    req.admin = {
      id: String(updatedAdmin._id),
      username: updatedAdmin.username,
      name: updatedAdmin.name,
      role: normalizeRole(updatedAdmin.role)
    };
    await recordAudit(req, {
      action: "auth.login",
      entityType: "admin_user",
      entityId: updatedAdmin._id,
      metadata: {}
    });

    return res.json({
      accessToken,
      refreshToken: refresh.refreshToken,
      tokenType: "Bearer",
      accessTokenExpiresIn: accessTokenInfo(),
      admin: sanitizeAdmin(updatedAdmin)
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed." });
  }
});

router.post("/refresh", requireDatabaseConnection, async (req, res) => {
  try {
    const refreshToken = String(req.body.refreshToken || "").trim();
    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required." });
    }

    const tokenHash = hashToken(refreshToken);
    const tokenDoc = await findRefreshTokenByHash(tokenHash);

    if (!tokenDoc) {
      return res.status(401).json({ message: "Invalid refresh token." });
    }

    if (tokenDoc.revokedAt) {
      return res.status(401).json({ message: "Refresh token has been revoked." });
    }

    if (tokenDoc.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({ message: "Refresh token has expired." });
    }

    const admin = tokenDoc.adminUser;
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Admin account is inactive." });
    }

    const rotated = await createRefreshToken({
      adminUserId: admin._id,
      ipAddress: resolveIpAddress(req)
    });

    await revokeRefreshToken({
      tokenHash: tokenDoc.tokenHash,
      replacedByTokenHash: rotated.tokenHash
    });

    await markRefreshTokenLastUsed(tokenDoc._id);

    const accessToken = signAccessToken(admin);
    req.admin = {
      id: String(admin._id),
      username: admin.username,
      name: admin.name,
      role: normalizeRole(admin.role)
    };
    await recordAudit(req, {
      action: "auth.refresh",
      entityType: "admin_user",
      entityId: admin._id,
      metadata: {}
    });

    return res.json({
      accessToken,
      refreshToken: rotated.refreshToken,
      tokenType: "Bearer",
      accessTokenExpiresIn: accessTokenInfo(),
      admin: sanitizeAdmin(admin)
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not refresh session." });
  }
});

router.post("/logout", requireDatabaseConnection, async (req, res) => {
  try {
    const refreshToken = String(req.body.refreshToken || "").trim();
    const allDevices = req.body.allDevices === true;

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required." });
    }

    const tokenHash = hashToken(refreshToken);
    const tokenDoc = await findRefreshTokenByHash(tokenHash);
    if (!tokenDoc) {
      return res.json({ message: "Already logged out." });
    }

    if (allDevices) {
      await revokeRefreshTokensForAdmin(tokenDoc.adminUser?._id);
    } else {
      await revokeRefreshTokenById(tokenDoc._id);
    }

    if (tokenDoc.adminUser) {
      req.admin = {
        id: String(tokenDoc.adminUser._id),
        username: tokenDoc.adminUser.username,
        name: tokenDoc.adminUser.name,
        role: normalizeRole(tokenDoc.adminUser.role)
      };
      await recordAudit(req, {
        action: allDevices ? "auth.logout_all" : "auth.logout",
        entityType: "admin_user",
        entityId: tokenDoc.adminUser._id,
        metadata: {}
      });
    }

    return res.json({ message: "Logged out." });
  } catch (error) {
    return res.status(500).json({ message: "Could not logout." });
  }
});

router.get("/me", requireDatabaseConnection, requireAdminAuth, async (req, res) => {
  try {
    const admin = await findAdminById(req.admin.id);

    if (!admin || !admin.isActive) {
      return res.status(404).json({ message: "Admin user not found." });
    }

    return res.json({ admin: sanitizeAdmin(admin) });
  } catch (error) {
    return res.status(500).json({ message: "Could not load admin profile." });
  }
});

module.exports = router;
module.exports.sanitizeAdmin = sanitizeAdmin;
