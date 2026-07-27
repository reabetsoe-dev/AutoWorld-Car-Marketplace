const express = require("express");
const bcrypt = require("bcryptjs");
const AdminUser = require("../models/AdminUser");
const RefreshToken = require("../models/RefreshToken");
const { requireAdminAuth } = require("../middleware/auth");
const { normalizeRole } = require("../constants/roles");
const {
  hashToken,
  signAccessToken,
  createRefreshToken,
  revokeRefreshToken
} = require("../utils/tokens");
const { recordAudit } = require("../utils/audit");

const router = express.Router();

function sanitizeAdmin(admin) {
  return {
    id: admin._id,
    username: admin.username,
    name: admin.name,
    role: normalizeRole(admin.role)
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

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required." });
    }

    const admin = await AdminUser.findOne({ username });
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const accessToken = signAccessToken(admin);
    const refresh = await createRefreshToken({
      adminUserId: admin._id,
      ipAddress: resolveIpAddress(req)
    });

    req.admin = {
      id: admin._id.toString(),
      username: admin.username,
      name: admin.name,
      role: normalizeRole(admin.role)
    };
    await recordAudit(req, {
      action: "auth.login",
      entityType: "admin_user",
      entityId: admin._id,
      metadata: {}
    });

    return res.json({
      accessToken,
      refreshToken: refresh.refreshToken,
      tokenType: "Bearer",
      accessTokenExpiresIn: accessTokenInfo(),
      admin: sanitizeAdmin(admin)
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed." });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = String(req.body.refreshToken || "").trim();
    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required." });
    }

    const tokenHash = hashToken(refreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash }).populate("adminUser");

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

    await RefreshToken.updateOne(
      { _id: tokenDoc._id },
      { $set: { lastUsedAt: new Date() } }
    );

    const accessToken = signAccessToken(admin);
    req.admin = {
      id: admin._id.toString(),
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

router.post("/logout", async (req, res) => {
  try {
    const refreshToken = String(req.body.refreshToken || "").trim();
    const allDevices = req.body.allDevices === true;

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken is required." });
    }

    const tokenHash = hashToken(refreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash }).populate("adminUser");
    if (!tokenDoc) {
      return res.json({ message: "Already logged out." });
    }

    const revocationTime = new Date();
    if (allDevices) {
      await RefreshToken.updateMany(
        { adminUser: tokenDoc.adminUser?._id, revokedAt: null },
        { $set: { revokedAt: revocationTime } }
      );
    } else {
      await RefreshToken.updateOne(
        { _id: tokenDoc._id, revokedAt: null },
        { $set: { revokedAt: revocationTime } }
      );
    }

    if (tokenDoc.adminUser) {
      req.admin = {
        id: tokenDoc.adminUser._id.toString(),
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

router.get("/me", requireAdminAuth, async (req, res) => {
  try {
    const admin = await AdminUser.findById(req.admin.id).select(
      "_id username name role isActive"
    );

    if (!admin || !admin.isActive) {
      return res.status(404).json({ message: "Admin user not found." });
    }

    return res.json({ admin: sanitizeAdmin(admin) });
  } catch (error) {
    return res.status(500).json({ message: "Could not load admin profile." });
  }
});

module.exports = router;
