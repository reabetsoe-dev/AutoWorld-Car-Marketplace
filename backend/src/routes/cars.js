const express = require("express");
const Car = require("../models/Car");
const { requireAdminAuth, requirePermission } = require("../middleware/auth");
const { recordAudit } = require("../utils/audit");

const router = express.Router();

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanOrUndefined(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "auction", "special", "specialoffer"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseImageUrls(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeCarPayload(body) {
  const payload = {
    title: typeof body.title === "string" ? body.title.trim() : undefined,
    brand: typeof body.brand === "string" ? body.brand.trim() : undefined,
    model: typeof body.model === "string" ? body.model.trim() : undefined,
    fuelType:
      typeof body.fuelType === "string" ? body.fuelType.trim().toLowerCase() : undefined,
    transmission:
      typeof body.transmission === "string"
        ? body.transmission.trim().toLowerCase()
        : undefined,
    description:
      typeof body.description === "string" ? body.description.trim() : undefined,
    location: typeof body.location === "string" ? body.location.trim() : undefined,
    year: numberOrUndefined(body.year),
    price: numberOrUndefined(body.price),
    mileage: numberOrUndefined(body.mileage),
    isAuction: Object.prototype.hasOwnProperty.call(body, "isAuction")
      ? booleanOrUndefined(body.isAuction)
      : undefined,
    isSpecialOffer: Object.prototype.hasOwnProperty.call(body, "isSpecialOffer")
      ? booleanOrUndefined(body.isSpecialOffer)
      : undefined,
    imageUrls: Object.prototype.hasOwnProperty.call(body, "imageUrls")
      ? parseImageUrls(body.imageUrls)
      : undefined
  };

  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

function buildCarFilters(query, includeSoldDefault = false) {
  const filters = {};
  const {
    brand,
    fuelType,
    minPrice,
    maxPrice,
    minMileage,
    maxMileage,
    search,
    includeSold,
    status,
    listingType,
    isAuction,
    isSpecialOffer
  } = query;

  const shouldIncludeSold =
    includeSold === "true" || includeSoldDefault === true;

  if (status === "sold") {
    filters.isSold = true;
  } else if (status === "available") {
    filters.isSold = false;
  } else if (!shouldIncludeSold) {
    filters.isSold = false;
  }

  if (brand) {
    filters.brand = new RegExp(String(brand).trim(), "i");
  }

  if (fuelType) {
    filters.fuelType = String(fuelType).trim().toLowerCase();
  }

  if (listingType === "auction") {
    filters.isAuction = true;
  } else if (listingType === "special") {
    filters.isSpecialOffer = true;
  } else if (listingType === "standard") {
    filters.isAuction = { $ne: true };
    filters.isSpecialOffer = { $ne: true };
  }

  const auctionFilter = booleanOrUndefined(isAuction);
  if (auctionFilter !== undefined) {
    filters.isAuction = auctionFilter;
  }

  const specialOfferFilter = booleanOrUndefined(isSpecialOffer);
  if (specialOfferFilter !== undefined) {
    filters.isSpecialOffer = specialOfferFilter;
  }

  const minPriceNum = numberOrUndefined(minPrice);
  const maxPriceNum = numberOrUndefined(maxPrice);
  if (minPriceNum !== undefined || maxPriceNum !== undefined) {
    filters.price = {};
    if (minPriceNum !== undefined) filters.price.$gte = minPriceNum;
    if (maxPriceNum !== undefined) filters.price.$lte = maxPriceNum;
  }

  const minMileageNum = numberOrUndefined(minMileage);
  const maxMileageNum = numberOrUndefined(maxMileage);
  if (minMileageNum !== undefined || maxMileageNum !== undefined) {
    filters.mileage = {};
    if (minMileageNum !== undefined) filters.mileage.$gte = minMileageNum;
    if (maxMileageNum !== undefined) filters.mileage.$lte = maxMileageNum;
  }

  if (search) {
    const expr = new RegExp(String(search).trim(), "i");
    filters.$or = [{ title: expr }, { brand: expr }, { model: expr }];
  }

  return filters;
}

function resolveSort(sortBy) {
  switch (sortBy) {
    case "priceAsc":
      return { price: 1 };
    case "priceDesc":
      return { price: -1 };
    case "mileageAsc":
      return { mileage: 1 };
    case "mileageDesc":
      return { mileage: -1 };
    case "oldest":
      return { createdAt: 1 };
    case "newest":
    default:
      return { createdAt: -1 };
  }
}

async function listCars(req, res, includeSoldDefault) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
  const skip = (page - 1) * limit;
  const sort = resolveSort(req.query.sort);
  const filters = buildCarFilters(req.query, includeSoldDefault);

  const [cars, total] = await Promise.all([
    Car.find(filters).sort(sort).skip(skip).limit(limit),
    Car.countDocuments(filters)
  ]);

  return res.json({
    data: cars,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  });
}

router.get("/", async (req, res) => {
  try {
    return await listCars(req, res, false);
  } catch (error) {
    return res.status(500).json({ message: "Could not load cars." });
  }
});

router.get(
  "/admin/all",
  requireAdminAuth,
  requirePermission("cars:view"),
  async (req, res) => {
  try {
    return await listCars(req, res, true);
  } catch (error) {
    return res.status(500).json({ message: "Could not load admin inventory." });
  }
  }
);

router.get("/:id", async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: "Car not found." });
    }
    return res.json(car);
  } catch (error) {
    return res.status(400).json({ message: "Invalid car id." });
  }
});

router.post(
  "/",
  requireAdminAuth,
  requirePermission("cars:create"),
  async (req, res) => {
  try {
    const payload = normalizeCarPayload(req.body);

    if (!payload.title || !payload.brand) {
      return res
        .status(400)
        .json({ message: "title and brand are required fields." });
    }

    if (payload.price === undefined || payload.mileage === undefined) {
      return res
        .status(400)
        .json({ message: "price and mileage are required fields." });
    }

    const car = await Car.create({
      ...payload,
      createdBy: req.admin.id
    });

    await recordAudit(req, {
      action: "car.create",
      entityType: "car",
      entityId: car._id,
      metadata: {
        title: car.title,
        brand: car.brand,
        price: car.price
      }
    });

    return res.status(201).json(car);
  } catch (error) {
    return res.status(500).json({ message: "Could not create car listing." });
  }
  }
);

router.put(
  "/:id",
  requireAdminAuth,
  requirePermission("cars:update"),
  async (req, res) => {
  try {
    const payload = normalizeCarPayload(req.body);
    const car = await Car.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!car) {
      return res.status(404).json({ message: "Car not found." });
    }

    await recordAudit(req, {
      action: "car.update",
      entityType: "car",
      entityId: car._id,
      metadata: {
        updatedFields: Object.keys(payload)
      }
    });

    return res.json(car);
  } catch (error) {
    return res.status(400).json({ message: "Could not update listing." });
  }
  }
);

router.patch(
  "/:id/sold",
  requireAdminAuth,
  requirePermission("cars:mark_sold"),
  async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { isSold: true, soldAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!car) {
      return res.status(404).json({ message: "Car not found." });
    }

    await recordAudit(req, {
      action: "car.mark_sold",
      entityType: "car",
      entityId: car._id,
      metadata: {
        soldAt: car.soldAt
      }
    });

    return res.json(car);
  } catch (error) {
    return res.status(400).json({ message: "Could not mark car as sold." });
  }
  }
);

router.patch(
  "/:id/unsold",
  requireAdminAuth,
  requirePermission("cars:mark_sold"),
  async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { isSold: false, soldAt: null },
      { new: true, runValidators: true }
    );

    if (!car) {
      return res.status(404).json({ message: "Car not found." });
    }

    await recordAudit(req, {
      action: "car.mark_available",
      entityType: "car",
      entityId: car._id,
      metadata: {}
    });

    return res.json(car);
  } catch (error) {
    return res.status(400).json({ message: "Could not mark car as available." });
  }
  }
);

router.delete(
  "/:id",
  requireAdminAuth,
  requirePermission("cars:delete"),
  async (req, res) => {
  try {
    const deleted = await Car.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Car not found." });
    }

    await recordAudit(req, {
      action: "car.delete",
      entityType: "car",
      entityId: deleted._id,
      metadata: {
        title: deleted.title
      }
    });
    return res.json({ message: "Car deleted." });
  } catch (error) {
    return res.status(400).json({ message: "Could not delete car." });
  }
  }
);

module.exports = router;
