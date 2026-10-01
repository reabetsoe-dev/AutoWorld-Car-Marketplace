const { query } = require("../db");

const SELLER_SELECT = `
  id,
  seller_type,
  dealership_name,
  owner_name,
  contact_person,
  primary_phone,
  whatsapp_number,
  email,
  district_town,
  physical_address,
  private_notes,
  created_by,
  updated_by,
  created_at,
  updated_at
`;

const fieldMap = {
  sellerType: "seller_type",
  dealershipName: "dealership_name",
  ownerName: "owner_name",
  contactPerson: "contact_person",
  primaryPhone: "primary_phone",
  whatsappNumber: "whatsapp_number",
  email: "email",
  districtTown: "district_town",
  physicalAddress: "physical_address",
  privateNotes: "private_notes",
  createdBy: "created_by",
  updatedBy: "updated_by"
};

function cleanOptional(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeSellerInput(input = {}) {
  const email = cleanOptional(input.email);
  return {
    sellerType: cleanOptional(input.sellerType),
    dealershipName: cleanOptional(input.dealershipName),
    ownerName: cleanOptional(input.ownerName),
    contactPerson: cleanOptional(input.contactPerson),
    primaryPhone: cleanOptional(input.primaryPhone),
    whatsappNumber: cleanOptional(input.whatsappNumber),
    email: email === undefined ? undefined : email?.toLowerCase() || null,
    districtTown: cleanOptional(input.districtTown),
    physicalAddress: cleanOptional(input.physicalAddress),
    privateNotes: cleanOptional(input.privateNotes),
    createdBy: cleanOptional(input.createdBy),
    updatedBy: cleanOptional(input.updatedBy)
  };
}

function toSeller(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    sellerType: row.seller_type,
    dealershipName: row.dealership_name || "",
    ownerName: row.owner_name || "",
    contactPerson: row.contact_person || "",
    primaryPhone: row.primary_phone || "",
    whatsappNumber: row.whatsapp_number || "",
    email: row.email || "",
    districtTown: row.district_town || "",
    physicalAddress: row.physical_address || "",
    privateNotes: row.private_notes || "",
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sellerFieldsFromRow(row, prefix = "seller_") {
  if (!row?.[`${prefix}id`]) return null;
  return toSeller({
    id: row[`${prefix}id`],
    seller_type: row[`${prefix}seller_type`],
    dealership_name: row[`${prefix}dealership_name`],
    owner_name: row[`${prefix}owner_name`],
    contact_person: row[`${prefix}contact_person`],
    primary_phone: row[`${prefix}primary_phone`],
    whatsapp_number: row[`${prefix}whatsapp_number`],
    email: row[`${prefix}email`],
    district_town: row[`${prefix}district_town`],
    physical_address: row[`${prefix}physical_address`],
    private_notes: row[`${prefix}private_notes`],
    created_by: row[`${prefix}created_by`],
    updated_by: row[`${prefix}updated_by`],
    created_at: row[`${prefix}created_at`],
    updated_at: row[`${prefix}updated_at`]
  });
}

function sellerJoinSelect(alias = "s", prefix = "seller_") {
  return `
    ${alias}.id AS ${prefix}id,
    ${alias}.seller_type AS ${prefix}seller_type,
    ${alias}.dealership_name AS ${prefix}dealership_name,
    ${alias}.owner_name AS ${prefix}owner_name,
    ${alias}.contact_person AS ${prefix}contact_person,
    ${alias}.primary_phone AS ${prefix}primary_phone,
    ${alias}.whatsapp_number AS ${prefix}whatsapp_number,
    ${alias}.email AS ${prefix}email,
    ${alias}.district_town AS ${prefix}district_town,
    ${alias}.physical_address AS ${prefix}physical_address,
    ${alias}.private_notes AS ${prefix}private_notes,
    ${alias}.created_by AS ${prefix}created_by,
    ${alias}.updated_by AS ${prefix}updated_by,
    ${alias}.created_at AS ${prefix}created_at,
    ${alias}.updated_at AS ${prefix}updated_at
  `;
}

async function findSellerById(id) {
  const result = await query(
    `SELECT ${SELLER_SELECT} FROM sellers WHERE id = $1 LIMIT 1`,
    [id]
  );
  return toSeller(result.rows[0]);
}

async function createSeller(input) {
  const seller = normalizeSellerInput(input);
  const result = await query(
    `INSERT INTO sellers (
       seller_type, dealership_name, owner_name, contact_person, primary_phone,
       whatsapp_number, email, district_town, physical_address, private_notes,
       created_by, updated_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${SELLER_SELECT}`,
    [
      seller.sellerType,
      seller.dealershipName,
      seller.ownerName,
      seller.contactPerson,
      seller.primaryPhone,
      seller.whatsappNumber,
      seller.email,
      seller.districtTown,
      seller.physicalAddress,
      seller.privateNotes,
      seller.createdBy,
      seller.updatedBy
    ]
  );
  return toSeller(result.rows[0]);
}

async function updateSeller(id, input) {
  const normalized = normalizeSellerInput(input);
  const assignments = [];
  const values = [];

  for (const [key, value] of Object.entries(normalized)) {
    const column = fieldMap[key];
    if (!column || value === undefined) continue;
    values.push(value);
    assignments.push(`${column} = $${values.length + 1}`);
  }

  if (assignments.length === 0) {
    return findSellerById(id);
  }

  const result = await query(
    `UPDATE sellers SET ${assignments.join(", ")} WHERE id = $1 RETURNING ${SELLER_SELECT}`,
    [id, ...values]
  );
  return toSeller(result.rows[0]);
}

async function listSellers(options = {}) {
  const params = [];
  const where = [];

  if (options.sellerType) {
    params.push(options.sellerType);
    where.push(`seller_type = $${params.length}`);
  }

  if (options.search) {
    params.push(`%${options.search}%`);
    const marker = `$${params.length}`;
    where.push(`(
      dealership_name ILIKE ${marker}
      OR owner_name ILIKE ${marker}
      OR contact_person ILIKE ${marker}
      OR primary_phone ILIKE ${marker}
      OR whatsapp_number ILIKE ${marker}
      OR email ILIKE ${marker}
      OR district_town ILIKE ${marker}
    )`);
  }

  const result = await query(
    `SELECT ${SELLER_SELECT}
     FROM sellers
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY seller_type ASC, dealership_name ASC NULLS LAST, owner_name ASC NULLS LAST, district_town ASC
     LIMIT 200`,
    params
  );

  return result.rows.map(toSeller);
}

module.exports = {
  createSeller,
  findSellerById,
  listSellers,
  sellerFieldsFromRow,
  sellerJoinSelect,
  toSeller,
  updateSeller
};
