const AuditLog = require("../models/AuditLog");
const { normalizeRole } = require("../constants/roles");

function resolveIpAddress(req) {
  const headerValue = req.headers["x-forwarded-for"];
  if (headerValue) {
    const first = String(headerValue).split(",")[0].trim();
    if (first) return first;
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null
  );
}

async function recordAudit(req, payload) {
  const actor = req.admin || {};
  const doc = {
    actorAdminUser: actor.id || null,
    actorName: actor.name || null,
    actorUsername: actor.username || null,
    actorRole: normalizeRole(actor.role || ""),
    action: payload.action,
    entityType: payload.entityType || null,
    entityId: payload.entityId ? String(payload.entityId) : null,
    metadata: payload.metadata || {},
    ipAddress: resolveIpAddress(req),
    userAgent: req.headers["user-agent"] || null
  };

  try {
    await AuditLog.create(doc);
  } catch (_error) {
    // Intentionally swallow errors to avoid blocking user flows.
  }
}

module.exports = {
  recordAudit
};
