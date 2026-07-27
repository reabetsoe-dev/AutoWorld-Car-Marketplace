const ROLES = {
  MANAGER: "manager",
  EDITOR: "editor",
  VIEWER: "viewer",
  ADMIN: "admin"
};

const ROLE_ALIASES = {
  [ROLES.ADMIN]: ROLES.MANAGER
};

const ROLE_PERMISSIONS = {
  [ROLES.MANAGER]: [
    "cars:view",
    "cars:create",
    "cars:update",
    "cars:delete",
    "cars:mark_sold",
    "admin:stats",
    "admin:upload",
    "admin:bulk_import",
    "audit:view",
    "users:manage"
  ],
  [ROLES.EDITOR]: [
    "cars:view",
    "cars:create",
    "cars:update",
    "cars:mark_sold",
    "admin:stats",
    "admin:upload",
    "admin:bulk_import",
    "audit:view"
  ],
  [ROLES.VIEWER]: ["cars:view", "admin:stats"]
};

function normalizeRole(inputRole) {
  const role = String(inputRole || "").trim().toLowerCase();
  const alias = ROLE_ALIASES[role];
  return alias || role || ROLES.VIEWER;
}

function rolePermissions(role) {
  return ROLE_PERMISSIONS[normalizeRole(role)] || [];
}

function hasPermission(role, permission) {
  return rolePermissions(role).includes(permission);
}

module.exports = {
  ROLES,
  ROLE_PERMISSIONS,
  normalizeRole,
  rolePermissions,
  hasPermission
};
