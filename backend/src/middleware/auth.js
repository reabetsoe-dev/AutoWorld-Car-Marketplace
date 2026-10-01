const jwt = require("jsonwebtoken");
const { hasPermission, normalizeRole } = require("../constants/roles");
const { getJwtSecret } = require("../utils/tokens");
const { requirePermission: permissionMiddleware } = require("./permissions");
const { findAdminById } = require("../repositories/adminUsers");

async function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Missing admin token." });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.tokenType && decoded.tokenType !== "access") {
      return res.status(401).json({ message: "Invalid access token." });
    }

    const adminUser = await findAdminById(decoded.id);
    if (!adminUser || !adminUser.isActive) {
      return res.status(401).json({ message: "Admin account is inactive." });
    }

    req.admin = {
      id: adminUser._id.toString(),
      username: adminUser.username,
      name: adminUser.name,
      role: normalizeRole(adminUser.role)
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired admin token." });
  }
}

function requirePermission(permission) {
  return permissionMiddleware(permission);
}

function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const role = normalizeRole(req.admin.role);
    const allowed = permissions.some((permission) => hasPermission(role, permission));
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions." });
    }
    return next();
  };
}

module.exports = {
  requireAdminAuth,
  requirePermission,
  requireAnyPermission
};
