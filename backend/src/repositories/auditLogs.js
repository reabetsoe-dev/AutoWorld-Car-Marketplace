const { query } = require("../db");

function toAuditLog(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    actorAdminUser: row.actor_admin_user_id || null,
    actorName: row.actor_name || null,
    actorUsername: row.actor_username || null,
    actorRole: row.actor_role || null,
    action: row.action,
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    metadata: row.metadata || {},
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseDateFilter(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function createAuditLog(input) {
  const result = await query(
    `INSERT INTO audit_logs (
       actor_admin_user_id, actor_name, actor_username, actor_role, action,
       entity_type, entity_id, metadata, ip_address, user_agent
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     RETURNING *`,
    [
      input.actorAdminUser || null,
      input.actorName || null,
      input.actorUsername || null,
      input.actorRole || null,
      input.action,
      input.entityType || null,
      input.entityId || null,
      JSON.stringify(input.metadata || {}),
      input.ipAddress || null,
      input.userAgent || null
    ]
  );
  return toAuditLog(result.rows[0]);
}

async function listAuditLogs(options = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 15));
  const offset = (page - 1) * limit;
  const params = [];
  const where = [];

  if (options.action) {
    params.push(`%${String(options.action).trim()}%`);
    where.push(`action ILIKE $${params.length}`);
  }

  if (options.actorUsername) {
    params.push(String(options.actorUsername).trim().toLowerCase());
    where.push(`actor_username = $${params.length}`);
  }

  const createdFrom = parseDateFilter(options.createdFrom || options.dateFrom);
  if (createdFrom) {
    params.push(createdFrom);
    where.push(`created_at >= $${params.length}`);
  }

  const createdTo = parseDateFilter(options.createdTo || options.dateTo);
  if (createdTo) {
    params.push(createdTo);
    where.push(`created_at <= $${params.length}`);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countResult = await query(
    `SELECT count(*)::int AS total FROM audit_logs ${clause}`,
    params
  );

  const result = await query(
    `SELECT * FROM audit_logs
     ${clause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const total = countResult.rows[0]?.total || 0;
  return {
    data: result.rows.map(toAuditLog),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

module.exports = {
  createAuditLog,
  listAuditLogs,
  toAuditLog
};
