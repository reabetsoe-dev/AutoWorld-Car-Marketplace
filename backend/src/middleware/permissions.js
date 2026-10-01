const { hasPermission, normalizeRole } = require("../constants/roles");

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }

    const role = normalizeRole(req.admin.role);

    if (!hasPermission(role, permission)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action."
      });
    }

    return next();
  };
}

module.exports = {
  requirePermission
};