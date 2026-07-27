const jwt = require("jsonwebtoken");
const { hasPermission, normalizeRole } = require("../constants/roles");

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Missing admin token." });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "development-only-secret"
    );
    if (decoded.tokenType && decoded.tokenType !== "access") {
      return res.status(401).json({ message: "Invalid access token." });
    }
    decoded.role = normalizeRole(decoded.role);
    req.admin = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired admin token." });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    const role = normalizeRole(req.admin?.role);
    if (!hasPermission(role, permission)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions." });
    }
    return next();
  };
}

function requireAnyPermission(permissions) {
  return (req, res, next) => {
    const role = normalizeRole(req.admin?.role);
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
