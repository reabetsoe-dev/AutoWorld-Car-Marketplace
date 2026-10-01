const { query } = require("../db");
const { toAdminUser } = require("./adminUsers");

const TOKEN_RETURNING = `
  id,
  token_hash,
  admin_user_id,
  expires_at,
  revoked_at,
  replaced_by_token_hash,
  created_by_ip,
  last_used_at,
  created_at,
  updated_at
`;

const TOKEN_SELECT = `
  rt.id,
  rt.token_hash,
  rt.admin_user_id,
  rt.expires_at,
  rt.revoked_at,
  rt.replaced_by_token_hash,
  rt.created_by_ip,
  rt.last_used_at,
  rt.created_at,
  rt.updated_at
`;

function toRefreshToken(row, options = {}) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    tokenHash: row.token_hash,
    adminUserId: row.admin_user_id,
    adminUser: options.adminUser || undefined,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at || null,
    replacedByTokenHash: row.replaced_by_token_hash || null,
    createdByIp: row.created_by_ip || null,
    lastUsedAt: row.last_used_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function adminFromJoinedRow(row) {
  if (!row?.admin_id) return null;
  return toAdminUser({
    id: row.admin_id,
    username: row.admin_username,
    email: row.admin_email,
    password_hash: row.admin_password_hash,
    name: row.admin_name,
    role: row.admin_role,
    is_active: row.admin_is_active,
    failed_login_attempts: row.admin_failed_login_attempts,
    lock_until: row.admin_lock_until,
    last_login: row.admin_last_login,
    password_changed_at: row.admin_password_changed_at,
    created_at: row.admin_created_at,
    updated_at: row.admin_updated_at
  });
}

async function createRefreshTokenRecord(input) {
  const result = await query(
    `INSERT INTO refresh_tokens (token_hash, admin_user_id, expires_at, created_by_ip)
     VALUES ($1, $2, $3, $4)
     RETURNING ${TOKEN_RETURNING}`,
    [input.tokenHash, input.adminUserId, input.expiresAt, input.createdByIp || null]
  );
  return toRefreshToken(result.rows[0]);
}

async function findRefreshTokenByHash(tokenHash) {
  const result = await query(
    `SELECT
       ${TOKEN_SELECT},
       au.id AS admin_id,
       au.username AS admin_username,
       au.email AS admin_email,
       au.password_hash AS admin_password_hash,
       au.name AS admin_name,
       au.role AS admin_role,
       au.is_active AS admin_is_active,
       au.failed_login_attempts AS admin_failed_login_attempts,
       au.lock_until AS admin_lock_until,
       au.last_login AS admin_last_login,
       au.password_changed_at AS admin_password_changed_at,
       au.created_at AS admin_created_at,
       au.updated_at AS admin_updated_at
     FROM refresh_tokens rt
     LEFT JOIN admin_users au ON au.id = rt.admin_user_id
     WHERE rt.token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  const row = result.rows[0];
  return toRefreshToken(row, { adminUser: adminFromJoinedRow(row) });
}

async function revokeRefreshTokenByHash(tokenHash, replacedByTokenHash = null) {
  const result = await query(
    `UPDATE refresh_tokens
     SET revoked_at = now(), replaced_by_token_hash = $2
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING ${TOKEN_RETURNING}`,
    [tokenHash, replacedByTokenHash]
  );
  return toRefreshToken(result.rows[0]);
}

async function revokeRefreshTokenById(id) {
  const result = await query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE id = $1 AND revoked_at IS NULL
     RETURNING ${TOKEN_RETURNING}`,
    [id]
  );
  return toRefreshToken(result.rows[0]);
}

async function revokeRefreshTokensForAdmin(adminUserId) {
  const result = await query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE admin_user_id = $1 AND revoked_at IS NULL`,
    [adminUserId]
  );
  return result.rowCount;
}

async function markRefreshTokenLastUsed(id) {
  const result = await query(
    `UPDATE refresh_tokens SET last_used_at = now() WHERE id = $1 RETURNING ${TOKEN_RETURNING}`,
    [id]
  );
  return toRefreshToken(result.rows[0]);
}

module.exports = {
  createRefreshTokenRecord,
  findRefreshTokenByHash,
  markRefreshTokenLastUsed,
  revokeRefreshTokenByHash,
  revokeRefreshTokenById,
  revokeRefreshTokensForAdmin,
  toRefreshToken
};
