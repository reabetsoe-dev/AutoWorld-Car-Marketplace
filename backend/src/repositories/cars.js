const { query, withTransaction } = require("../db");
const { sellerFieldsFromRow, sellerJoinSelect } = require("./sellers");
const {
  CAR_CATEGORIES,
  DEFAULT_CAR_CATEGORY,
  normalizeCarCategory
} = require("../constants/carCategories");

const CAR_SELECT = `
  c.id,
  c.title,
  c.brand,
  c.model,
  c.category,
  c.year,
  c.price,
  c.mileage,
  c.availability_status,
  c.fuel_type,
  c.transmission,
  c.description,
  c.image_urls,
  c.location,
  c.is_auction,
  c.is_special_offer,
  c.is_sold,
  c.sold_at,
  c.seller_id,
  c.created_by,
  c.created_at,
  c.updated_at
`;

const fieldMap = {
  title: "title",
  brand: "brand",
  model: "model",
  category: "category",
  year: "year",
  price: "price",
  mileage: "mileage",
  availabilityStatus: "availability_status",
  fuelType: "fuel_type",
  transmission: "transmission",
  description: "description",
  imageUrls: "image_urls",
  location: "location",
  isAuction: "is_auction",
  isSpecialOffer: "is_special_offer",
  isSold: "is_sold",
  soldAt: "sold_at",
  seller: "seller_id",
  sellerId: "seller_id",
  createdBy: "created_by"
};

function numberFromNumeric(value) {
  if (value === null || value === undefined) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function toCar(row, options = {}) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    brand: row.brand,
    model: row.model || "",
    category: row.category || DEFAULT_CAR_CATEGORY,
    year: row.year,
    price: numberFromNumeric(row.price),
    mileage: row.mileage,
    availabilityStatus: row.availability_status || "readily_available",
    fuelType: row.fuel_type,
    transmission: row.transmission,
    description: row.description || "",
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
    location: row.location || "",
    isAuction: Boolean(row.is_auction),
    isSpecialOffer: Boolean(row.is_special_offer),
    isSold: Boolean(row.is_sold),
    soldAt: row.sold_at || null,
    seller: options.includeSeller ? sellerFieldsFromRow(row) : undefined,
    sellerId: row.seller_id || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function booleanOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "auction", "special", "specialoffer"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function buildWhere(queryParams = {}, includeSoldDefault = false) {
  const params = [];
  const where = [];
  const {
    brand,
    fuelType,
    minPrice,
    maxPrice,
    minMileage,
    maxMileage,
    search,
    category,
    includeSold,
    status,
    listingType,
    isAuction,
    isSpecialOffer,
    createdFrom,
    createdTo,
    dateFrom,
    dateTo
  } = queryParams;

  const shouldIncludeSold = includeSold === "true" || includeSoldDefault === true;

  if (status === "sold") {
    where.push("c.is_sold = true");
  } else if (status === "available") {
    where.push("c.is_sold = false");
  } else if (!shouldIncludeSold) {
    where.push("c.is_sold = false");
  }

  if (brand) {
    params.push(`%${String(brand).trim()}%`);
    where.push(`c.brand ILIKE $${params.length}`);
  }

  if (fuelType) {
    params.push(String(fuelType).trim().toLowerCase());
    where.push(`c.fuel_type = $${params.length}`);
  }

  const categoryFilter = normalizeCarCategory(category);
  if (categoryFilter && CAR_CATEGORIES.includes(categoryFilter)) {
    params.push(categoryFilter);
    where.push(`c.category = $${params.length}`);
  }

  if (listingType === "auction") {
    where.push("c.is_auction = true");
  } else if (listingType === "special") {
    where.push("c.is_special_offer = true");
  } else if (listingType === "standard") {
    where.push("c.is_auction = false");
    where.push("c.is_special_offer = false");
  }

  const auctionFilter = booleanOrUndefined(isAuction);
  if (auctionFilter !== undefined) {
    params.push(auctionFilter);
    where.push(`c.is_auction = $${params.length}`);
  }

  const specialOfferFilter = booleanOrUndefined(isSpecialOffer);
  if (specialOfferFilter !== undefined) {
    params.push(specialOfferFilter);
    where.push(`c.is_special_offer = $${params.length}`);
  }

  const minPriceNum = numberOrUndefined(minPrice);
  const maxPriceNum = numberOrUndefined(maxPrice);
  if (minPriceNum !== undefined) {
    params.push(minPriceNum);
    where.push(`c.price >= $${params.length}`);
  }
  if (maxPriceNum !== undefined) {
    params.push(maxPriceNum);
    where.push(`c.price <= $${params.length}`);
  }

  const minMileageNum = numberOrUndefined(minMileage);
  const maxMileageNum = numberOrUndefined(maxMileage);
  if (minMileageNum !== undefined) {
    params.push(minMileageNum);
    where.push(`c.mileage >= $${params.length}`);
  }
  if (maxMileageNum !== undefined) {
    params.push(maxMileageNum);
    where.push(`c.mileage <= $${params.length}`);
  }

  if (search) {
    params.push(`%${String(search).trim()}%`);
    const marker = `$${params.length}`;
    where.push(`(c.title ILIKE ${marker} OR c.brand ILIKE ${marker} OR c.model ILIKE ${marker})`);
  }

  const createdFromDate = dateOrUndefined(createdFrom || dateFrom);
  if (createdFromDate) {
    params.push(createdFromDate);
    where.push(`c.created_at >= $${params.length}`);
  }

  const createdToDate = dateOrUndefined(createdTo || dateTo);
  if (createdToDate) {
    params.push(createdToDate);
    where.push(`c.created_at <= $${params.length}`);
  }

  return {
    params,
    clause: where.length ? `WHERE ${where.join(" AND ")}` : ""
  };
}

function resolveSort(sortBy) {
  switch (sortBy) {
    case "priceAsc":
      return "c.price ASC";
    case "priceDesc":
      return "c.price DESC";
    case "mileageAsc":
      return "c.mileage ASC";
    case "mileageDesc":
      return "c.mileage DESC";
    case "oldest":
      return "c.created_at ASC";
    case "newest":
    default:
      return "c.created_at DESC";
  }
}

function normalizeCarInput(input = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.prototype.hasOwnProperty.call(fieldMap, key) || value === undefined) {
      continue;
    }
    clean[key] = value === "" ? null : value;
  }
  return clean;
}

async function findCarById(id, options = {}) {
  const includeSeller = Boolean(options.includeSeller);
  const result = await query(
    `SELECT ${CAR_SELECT}${includeSeller ? `, ${sellerJoinSelect("s")}` : ""}
     FROM cars c
     ${includeSeller ? "LEFT JOIN sellers s ON s.id = c.seller_id" : ""}
     WHERE c.id = $1
     LIMIT 1`,
    [id]
  );
  return toCar(result.rows[0], { includeSeller });
}

async function listCars(options = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 12));
  const offset = (page - 1) * limit;
  const includeSeller = Boolean(options.includeSeller);
  const where = buildWhere(options.query || {}, Boolean(options.includeSoldDefault));
  const countResult = await query(
    `SELECT count(*)::int AS total FROM cars c ${where.clause}`,
    where.params
  );

  const params = [...where.params, limit, offset];
  const result = await query(
    `SELECT ${CAR_SELECT}${includeSeller ? `, ${sellerJoinSelect("s")}` : ""}
     FROM cars c
     ${includeSeller ? "LEFT JOIN sellers s ON s.id = c.seller_id" : ""}
     ${where.clause}
     ORDER BY ${resolveSort(options.sort)}
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params
  );

  const total = countResult.rows[0]?.total || 0;
  return {
    data: result.rows.map((row) => toCar(row, { includeSeller })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function createCar(input) {
  const car = normalizeCarInput(input);
  const columns = Object.keys(car).map((key) => fieldMap[key]);
  const values = Object.values(car);
  const placeholders = values.map((_, index) => `$${index + 1}`);

  const result = await query(
    `INSERT INTO cars (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING id`,
    values
  );

  return findCarById(result.rows[0].id, { includeSeller: true });
}

async function updateCar(id, input, options = {}) {
  const car = normalizeCarInput(input);
  const assignments = [];
  const values = [];

  for (const [key, value] of Object.entries(car)) {
    const column = fieldMap[key];
    values.push(value);
    assignments.push(`${column} = $${values.length + 1}`);
  }

  if (assignments.length > 0) {
    await query(
      `UPDATE cars SET ${assignments.join(", ")} WHERE id = $1`,
      [id, ...values]
    );
  }

  return findCarById(id, { includeSeller: options.includeSeller });
}

async function markCarSold(id, sold) {
  const result = await query(
    `UPDATE cars
     SET is_sold = $2, sold_at = $3
     WHERE id = $1
     RETURNING id`,
    [id, Boolean(sold), sold ? new Date() : null]
  );
  return result.rows[0] ? findCarById(result.rows[0].id) : null;
}

async function deleteCar(id) {
  const car = await findCarById(id);
  if (!car) {
    return null;
  }

  const result = await query(
    `DELETE FROM cars WHERE id = $1`,
    [id]
  );
  return result.rowCount > 0 ? car : null;
}

async function insertManyCars(cars) {
  return withTransaction(async (client) => {
    let createdCount = 0;

    for (const input of cars) {
      const car = normalizeCarInput(input);
      const columns = Object.keys(car).map((key) => fieldMap[key]);
      const values = Object.values(car);
      const placeholders = values.map((_, index) => `$${index + 1}`);
      await client.query(
        `INSERT INTO cars (${columns.join(", ")})
         VALUES (${placeholders.join(", ")})`,
        values
      );
      createdCount += 1;
    }

    return createdCount;
  });
}

async function getCarStats(options = {}) {
  const where = buildWhere(options.query || {}, true);
  const [summaryResult, brandResult] = await Promise.all([
    query(`
      SELECT
        count(*)::int AS total_cars,
        count(*) FILTER (WHERE is_sold = true)::int AS sold_cars,
        count(*) FILTER (WHERE is_sold = false)::int AS available_cars,
        coalesce(sum(price) FILTER (WHERE is_sold = false), 0)::numeric AS total_inventory_value,
        coalesce(avg(price), 0)::numeric AS average_price,
        coalesce(avg(mileage), 0)::numeric AS average_mileage
      FROM cars c
      ${where.clause}
    `, where.params),
    query(`
      SELECT
        coalesce(brand, 'Unknown') AS brand,
        count(*)::int AS total,
        count(*) FILTER (WHERE is_sold = false)::int AS available,
        count(*) FILTER (WHERE is_sold = true)::int AS sold
      FROM cars c
      ${where.clause}
      GROUP BY brand
      ORDER BY total DESC, brand ASC
      LIMIT 8
    `, where.params)
  ]);

  const summaryRow = summaryResult.rows[0] || {};
  return {
    summary: {
      totalCars: Number(summaryRow.total_cars || 0),
      soldCars: Number(summaryRow.sold_cars || 0),
      availableCars: Number(summaryRow.available_cars || 0),
      totalInventoryValue: numberFromNumeric(summaryRow.total_inventory_value || 0),
      averagePrice: numberFromNumeric(summaryRow.average_price || 0),
      averageMileage: numberFromNumeric(summaryRow.average_mileage || 0)
    },
    brandBreakdown: brandResult.rows.map((row) => ({
      brand: row.brand || "Unknown",
      total: Number(row.total || 0),
      available: Number(row.available || 0),
      sold: Number(row.sold || 0)
    }))
  };
}

module.exports = {
  createCar,
  deleteCar,
  findCarById,
  getCarStats,
  insertManyCars,
  listCars,
  markCarSold,
  toCar,
  updateCar
};
