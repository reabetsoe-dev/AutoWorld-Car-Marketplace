const { query } = require("../db");

const fieldMap = {
  make: "make",
  model: "model",
  year: "year",
  mileage: "mileage",
  expectedPrice: "expected_price",
  condition: "condition",
  fuelType: "fuel_type",
  transmission: "transmission",
  location: "location",
  ownerName: "owner_name",
  phone: "phone",
  email: "email",
  notes: "notes",
  images: "images",
  status: "status",
  adminNotes: "admin_notes",
  reviewedBy: "reviewed_by",
  reviewedAt: "reviewed_at"
};

function numberFromNumeric(value) {
  if (value === null || value === undefined) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function toSellRequest(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    mileage: row.mileage,
    expectedPrice: numberFromNumeric(row.expected_price),
    condition: row.condition,
    fuelType: row.fuel_type,
    transmission: row.transmission,
    location: row.location,
    ownerName: row.owner_name,
    phone: row.phone,
    email: row.email || "",
    notes: row.notes || "",
    images: Array.isArray(row.images) ? row.images : [],
    status: row.status,
    adminNotes: row.admin_notes || "",
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeInput(input = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.prototype.hasOwnProperty.call(fieldMap, key) || value === undefined) {
      continue;
    }
    clean[key] = value === "" ? null : value;
  }
  return clean;
}

async function createSellRequest(input) {
  const payload = normalizeInput(input);
  const columns = Object.keys(payload).map((key) => fieldMap[key]);
  const values = Object.entries(payload).map(([key, value]) =>
    key === "images" ? JSON.stringify(value || []) : value
  );
  const placeholders = Object.keys(payload).map((key, index) =>
    key === "images" ? `$${index + 1}::jsonb` : `$${index + 1}`
  );

  const result = await query(
    `INSERT INTO sell_requests (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING *`,
    values
  );

  return toSellRequest(result.rows[0]);
}

function buildFilters(queryParams = {}) {
  const params = [];
  const where = [];

  if (queryParams.status && queryParams.status !== "all") {
    params.push(String(queryParams.status).trim().toLowerCase());
    where.push(`status = $${params.length}`);
  }

  if (queryParams.search) {
    params.push(`%${String(queryParams.search).trim()}%`);
    const marker = `$${params.length}`;
    where.push(`(
      make ILIKE ${marker}
      OR model ILIKE ${marker}
      OR owner_name ILIKE ${marker}
      OR phone ILIKE ${marker}
      OR location ILIKE ${marker}
    )`);
  }

  return {
    params,
    clause: where.length ? `WHERE ${where.join(" AND ")}` : ""
  };
}

async function listSellRequests(options = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 12));
  const offset = (page - 1) * limit;
  const filters = buildFilters(options.query || {});

  const countResult = await query(
    `SELECT count(*)::int AS total FROM sell_requests ${filters.clause}`,
    filters.params
  );

  const result = await query(
    `SELECT * FROM sell_requests
     ${filters.clause}
     ORDER BY created_at DESC
     LIMIT $${filters.params.length + 1}
     OFFSET $${filters.params.length + 2}`,
    [...filters.params, limit, offset]
  );

  const total = countResult.rows[0]?.total || 0;
  return {
    data: result.rows.map(toSellRequest),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function updateSellRequest(id, input) {
  const payload = normalizeInput(input);
  const assignments = [];
  const values = [];

  for (const [key, value] of Object.entries(payload)) {
    const column = fieldMap[key];
    values.push(key === "images" ? JSON.stringify(value || []) : value);
    assignments.push(`${column} = $${values.length + 1}${key === "images" ? "::jsonb" : ""}`);
  }

  if (assignments.length === 0) {
    const result = await query("SELECT * FROM sell_requests WHERE id = $1", [id]);
    return toSellRequest(result.rows[0]);
  }

  const result = await query(
    `UPDATE sell_requests SET ${assignments.join(", ")}
     WHERE id = $1
     RETURNING *`,
    [id, ...values]
  );
  return toSellRequest(result.rows[0]);
}

module.exports = {
  createSellRequest,
  listSellRequests,
  toSellRequest,
  updateSellRequest
};
