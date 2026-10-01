const { query } = require("../db");
const { normalizeRole } = require("../constants/roles");

const ADMIN_SELECT = `
  id,
  username,
  email,
  password_hash,
  name,
  role,
  is_active,
  failed_login_attempts,
  lock_until,
  last_login,
  password_changed_at,
  created_at,
  updated_at
`;

const fieldMap = {
  username: "username",
  email: "email",
  passwordHash: "password_hash",
  name: "name",
  role: "role",
  isActive: "is_active",
  failedLoginAttempts: "failed_login_attempts",
  lockUntil: "lock_until",
  lastLogin: "last_login",
  passwordChangedAt: "password_changed_at"
};

function toAdminUser(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    username: row.username,
    email: row.email || "",
    passwordHash: row.password_hash,
    name: row.name,
    role: normalizeRole(row.role),
    isActive: Boolean(row.is_active),
    failedLoginAttempts: Number(row.failed_login_attempts || 0),
    lockUntil: row.lock_until || null,
    lastLogin: row.last_login || null,
    passwordChangedAt: row.password_changed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeAdminInput(input = {}) {
  const clean = { ...input };
  if (clean.username !== undefined) {
    clean.username = String(clean.username || "").trim().toLowerCase();
  }
  if (clean.email !== undefined) {
    clean.email = String(clean.email || "").trim().toLowerCase() || null;
  }
  if (clean.name !== undefined) {
    clean.name = String(clean.name || "").trim();
  }
  if (clean.role !== undefined) {
    clean.role = normalizeRole(clean.role);
  }
  return clean;
}

function buildUpdate(input = {}, startIndex = 2) {
  const assignments = [];
  const values = [];
  const normalized = normalizeAdminInput(input);

  for (const [key, value] of Object.entries(normalized)) {
    const column = fieldMap[key];
    if (!column || value === undefined) continue;
    values.push(value);
    assignments.push(`${column} = $${values.length + startIndex - 1}`);
  }

  return { assignments, values };
}

async function findAdminByUsername(username) {
  const result = await query(
    `SELECT ${ADMIN_SELECT} FROM admin_users WHERE username = $1 LIMIT 1`,
    [String(username || "").trim().toLowerCase()]
  );
  return toAdminUser(result.rows[0]);
}

async function findAdminByEmail(email) {
  const result = await query(
    `SELECT ${ADMIN_SELECT} FROM admin_users WHERE email = $1 LIMIT 1`,
    [String(email || "").trim().toLowerCase()]
  );
  return toAdminUser(result.rows[0]);
}

async function findAdminById(id) {
  const result = await query(
    `SELECT ${ADMIN_SELECT} FROM admin_users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return toAdminUser(result.rows[0]);
}

async function listAdminUsers() {
  const result = await query(
    `SELECT ${ADMIN_SELECT} FROM admin_users ORDER BY created_at DESC`
  );
  return result.rows.map(toAdminUser);
}

async function createAdminUser(input) {
  const normalized = normalizeAdminInput(input);
  const result = await query(
    `INSERT INTO admin_users (username, email, password_hash, name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${ADMIN_SELECT}`,
    [
      normalized.username,
      normalized.email || null,
      normalized.passwordHash,
      normalized.name,
      normalized.role || "manager",
      normalized.isActive !== undefined ? Boolean(normalized.isActive) : true
    ]
  );
  return toAdminUser(result.rows[0]);
}

async function updateAdminUser(id, input) {
  const { assignments, values } = buildUpdate(input);
  if (assignments.length === 0) {
    return findAdminById(id);
  }

  const result = await query(
    `UPDATE admin_users SET ${assignments.join(", ")} WHERE id = $1 RETURNING ${ADMIN_SELECT}`,
    [id, ...values]
  );
  return toAdminUser(result.rows[0]);
}

module.exports = {
  createAdminUser,
  findAdminByEmail,
  findAdminById,
  findAdminByUsername,
  listAdminUsers,
  toAdminUser,
  updateAdminUser
};
