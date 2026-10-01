const ROLES = {
  MANAGER: "manager",
  EDITOR: "editor",
  VIEWER: "viewer",
  ADMIN: "admin"
};

const ROLE_ALIASES = {};
const ROLE_VALUES = Object.values(ROLES);

const PERMISSIONS = {
  CARS_VIEW: "cars:view",
  CARS_CREATE: "cars:create",
  CARS_UPDATE: "cars:update",
  CARS_DELETE: "cars:delete",
  CARS_MARK_SOLD: "cars:mark_sold",

  SELL_REQUESTS_VIEW: "sell_requests:view",
  SELL_REQUESTS_UPDATE: "sell_requests:update",

  ADMIN_STATS: "admin:stats",
  ADMIN_UPLOAD: "admin:upload",
  ADMIN_BULK_IMPORT: "admin:bulk_import",

  AUDIT_VIEW: "audit:view",

  USERS_MANAGE: "users:manage",

  SYSTEM_SETTINGS: "system:settings"
};

const VIEWER_PERMISSIONS = [PERMISSIONS.CARS_VIEW, PERMISSIONS.ADMIN_STATS];

const EDITOR_PERMISSIONS = [
  ...VIEWER_PERMISSIONS,
  PERMISSIONS.CARS_CREATE,
  PERMISSIONS.CARS_UPDATE,
  PERMISSIONS.CARS_MARK_SOLD,
  PERMISSIONS.SELL_REQUESTS_VIEW,
  PERMISSIONS.SELL_REQUESTS_UPDATE,
  PERMISSIONS.ADMIN_UPLOAD,
  PERMISSIONS.ADMIN_BULK_IMPORT,
  PERMISSIONS.AUDIT_VIEW
];

const MANAGER_PERMISSIONS = [
  ...EDITOR_PERMISSIONS,
  PERMISSIONS.CARS_DELETE,
  PERMISSIONS.USERS_MANAGE
];

const ADMIN_PERMISSIONS = [...MANAGER_PERMISSIONS, PERMISSIONS.SYSTEM_SETTINGS];

const ROLE_PERMISSIONS = {
  [ROLES.VIEWER]: VIEWER_PERMISSIONS,
  [ROLES.EDITOR]: EDITOR_PERMISSIONS,
  [ROLES.MANAGER]: MANAGER_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS
};

function normalizeRole(inputRole) {
  const role = String(inputRole || "").trim().toLowerCase();
  const alias = ROLE_ALIASES[role];
  return alias || role || ROLES.VIEWER;
}

function isKnownRole(inputRole) {
  return ROLE_VALUES.includes(normalizeRole(inputRole));
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
  ROLE_VALUES,
  PERMISSIONS,
  isKnownRole,
  normalizeRole,
  rolePermissions,
  hasPermission
};
