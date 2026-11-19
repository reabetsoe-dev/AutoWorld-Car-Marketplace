const express = require("express");
const { requireAdminAuth } = require("../middleware/auth");
const { requireDatabaseConnection } = require("../middleware/database");
const { requirePermission } = require("../middleware/permissions");
const { PERMISSIONS } = require("../constants/roles");
const { recordAudit } = require("../utils/audit");
const { buildCarTitle } = require("../utils/carTitles");
const {
  SELLER_TYPES,
  normalizeSellerId,
  normalizeSellerPayload,
  serializeAdminCar,
  serializeAdminSeller,
  serializePublicCar,
  validateSellerPayload
} = require("../utils/carSellers");
const {
  DEFAULT_CAR_CATEGORY,
  isCarCategory,
  normalizeCarCategory
} = require("../constants/carCategories");
const {
  DEFAULT_ACCESSORY_AVAILABILITY,
  isAccessoryAvailability,
  normalizeAccessoryAvailability
} = require("../constants/accessoryAvailability");
const {
  createCar,
  deleteCar,
  findCarById,
  listCars: listCarsRepo,
  markCarSold,
  updateCar
} = require("../repositories/cars");
const {
  createSeller,
  findSellerById,
  listSellers,
  updateSeller
} = require("../repositories/sellers");

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
    category: Object.prototype.hasOwnProperty.call(body, "category")
      ? normalizeCarCategory(body.category)
      : undefined,
    availabilityStatus: Object.prototype.hasOwnProperty.call(body, "availabilityStatus")
      ? normalizeAccessoryAvailability(body.availabilityStatus)
      : undefined,
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

function clientError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateAvailabilityStatus(payload) {
  if (
    payload.availabilityStatus !== undefined &&
    !isAccessoryAvailability(payload.availabilityStatus)
  ) {
    return "availabilityStatus must be one of: readily_available, on_order.";
  }

  return null;
}

function applyCategoryDefaults(payload, category) {
  if (category === "accessory") {
    payload.availabilityStatus = payload.availabilityStatus || DEFAULT_ACCESSORY_AVAILABILITY;
    payload.mileage = 0;
    payload.year = null;
    payload.fuelType = "other";
    payload.transmission = "other";
    return;
  }

  if (payload.availabilityStatus !== undefined) {
    payload.availabilityStatus = DEFAULT_ACCESSORY_AVAILABILITY;
  }
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}

function hasSellerPayload(payload) {
  return Object.values(payload).some((value) => value !== undefined);
}

function mergeSellerPayload(existingSeller, payload) {
  const existing = serializeAdminSeller(existingSeller) || {};
  return {
    sellerType: payload.sellerType !== undefined ? payload.sellerType : existing.sellerType,
    dealershipName:
      payload.dealershipName !== undefined ? payload.dealershipName : existing.dealershipName,
    ownerName: payload.ownerName !== undefined ? payload.ownerName : existing.ownerName,
    contactPerson:
      payload.contactPerson !== undefined ? payload.contactPerson : existing.contactPerson,
    primaryPhone:
      payload.primaryPhone !== undefined ? payload.primaryPhone : existing.primaryPhone,
    whatsappNumber:
      payload.whatsappNumber !== undefined ? payload.whatsappNumber : existing.whatsappNumber,
    email: payload.email !== undefined ? payload.email : existing.email,
    districtTown:
      payload.districtTown !== undefined ? payload.districtTown : existing.districtTown,
    physicalAddress:
      payload.physicalAddress !== undefined ? payload.physicalAddress : existing.physicalAddress,
    privateNotes:
      payload.privateNotes !== undefined ? payload.privateNotes : existing.privateNotes
  };
}

async function resolveSellerForCar(body, adminId) {
  const sellerId = normalizeSellerId(body.sellerId);
  if (sellerId === null) {
    throw clientError("Selected seller is invalid.");
  }

  const sellerPayload = normalizeSellerPayload(body.seller || {});
  const hasPayload = hasSellerPayload(sellerPayload);

  if (sellerId) {
    const seller = await findSellerById(sellerId);
    if (!seller) {
      throw clientError("Selected seller was not found.", 404);
    }

    if (hasPayload) {
      const mergedPayload = mergeSellerPayload(seller, sellerPayload);
      const validationErrors = validateSellerPayload(mergedPayload);
      if (validationErrors.length > 0) {
        throw clientError(validationErrors.join(" "));
      }

      return updateSeller(sellerId, {
        ...compactPayload(sellerPayload),
        updatedBy: adminId
      });
    }

    return seller;
  }

  if (!hasPayload) {
    throw clientError("Seller information is required.");
  }

  const validationErrors = validateSellerPayload(sellerPayload);
  if (validationErrors.length > 0) {
    throw clientError(validationErrors.join(" "));
  }

  return createSeller({
    ...sellerPayload,
    createdBy: adminId,
    updatedBy: adminId
  });
}

function sendCarError(res, error, fallbackMessage, fallbackStatus = 500) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error.name === "ValidationError") {
    const message = Object.values(error.errors || {})
      .map((item) => item.message)
      .filter(Boolean)
      .join(" ");
    return res.status(400).json({ message: message || fallbackMessage });
  }

  return res.status(fallbackStatus).json({ message: fallbackMessage });
}

async function listCars(req, res, includeSoldDefault, includePrivateSeller = false) {
  const result = await listCarsRepo({
    page: req.query.page,
    limit: req.query.limit,
    sort: req.query.sort,
    query: req.query,
    includeSoldDefault,
    includeSeller: includePrivateSeller,
    adminCreatedOnly: !includePrivateSeller
  });

  return res.json({
    data: includePrivateSeller
      ? result.data.map(serializeAdminCar)
      : result.data.map(serializePublicCar),
    pagination: result.pagination
  });
}

router.get("/", requireDatabaseConnection, async (req, res) => {
  try {
    return await listCars(req, res, false);
  } catch (error) {
    return res.status(500).json({ message: "Could not load cars." });
  }
});

router.get(
  "/admin/sellers",
  requireDatabaseConnection,
  requireAdminAuth,
  requirePermission(PERMISSIONS.CARS_VIEW),
  async (req, res) => {
    try {
      const sellerType = String(req.query.sellerType || "").trim().toLowerCase();
      const search = String(req.query.search || "").trim();
      const sellers = await listSellers({
        sellerType: SELLER_TYPES.includes(sellerType) ? sellerType : undefined,
        search
      });

      return res.json({ data: sellers.map(serializeAdminSeller) });
    } catch (error) {
      return res.status(500).json({ message: "Could not load sellers." });
    }
  }
);

router.get(
  "/admin/all",
  requireDatabaseConnection,
  requireAdminAuth,
  requirePermission(PERMISSIONS.CARS_VIEW),
  async (req, res) => {
    try {
      return await listCars(req, res, true, true);
    } catch (error) {
      return res.status(500).json({ message: "Could not load admin inventory." });
    }
  }
);

router.get(
  "/admin/:id",
  requireDatabaseConnection,
  requireAdminAuth,
  requirePermission(PERMISSIONS.CARS_VIEW),
  async (req, res) => {
    try {
      const car = await findCarById(req.params.id, { includeSeller: true });
      if (!car) {
        return res.status(404).json({ message: "Car not found." });
      }
      return res.json(serializeAdminCar(car));
    } catch (error) {
      return res.status(400).json({ message: "Invalid car id." });
    }
  }
);

router.get("/:id", requireDatabaseConnection, async (req, res) => {
  try {
    const car = await findCarById(req.params.id, { adminCreatedOnly: true });
    if (!car) {
      return res.status(404).json({ message: "Car not found." });
    }
    return res.json(serializePublicCar(car));
  } catch (error) {
    return res.status(400).json({ message: "Invalid car id." });
  }
});

router.post(
  "/",
  requireDatabaseConnection,
  requireAdminAuth,
  requirePermission(PERMISSIONS.CARS_CREATE),
  async (req, res) => {
    try {
      const payload = normalizeCarPayload(req.body);

      if (!payload.brand) {
        return res
          .status(400)
          .json({ message: "brand is a required field." });
      }

      payload.category = payload.category || DEFAULT_CAR_CATEGORY;
      if (!isCarCategory(payload.category)) {
        return res.status(400).json({
          message: "category must be one of: car, bakkie, motorcycle, commercial, accessory."
        });
      }

      const availabilityError = validateAvailabilityStatus(payload);
      if (availabilityError) {
        return res.status(400).json({ message: availabilityError });
      }
      applyCategoryDefaults(payload, payload.category);

      payload.title = payload.title || buildCarTitle(payload);

      if (payload.price === undefined) {
        return res
          .status(400)
          .json({ message: "price is a required field." });
      }

      if (payload.mileage === undefined) {
        return res
          .status(400)
          .json({ message: "mileage is a required field." });
      }

      const seller = await resolveSellerForCar(req.body, req.admin.id);

      const car = await createCar({
        ...payload,
        seller: seller._id,
        location: seller.districtTown,
        createdBy: req.admin.id
      });
      await recordAudit(req, {
        action: "car.create",
        entityType: "car",
        entityId: car._id,
        metadata: {
          title: car.title,
          brand: car.brand,
          price: car.price,
          seller: seller._id
        }
      });

      return res.status(201).json(serializeAdminCar(car));
    } catch (error) {
      return sendCarError(res, error, "Could not create car listing.");
    }
  }
);

router.put(
  "/:id",
  requireDatabaseConnection,
  requireAdminAuth,
  requirePermission(PERMISSIONS.CARS_UPDATE),
  async (req, res) => {
    try {
      const payload = normalizeCarPayload(req.body);
      if (payload.category !== undefined && !isCarCategory(payload.category)) {
        return res.status(400).json({
          message: "category must be one of: car, bakkie, motorcycle, commercial, accessory."
        });
      }

      const availabilityError = validateAvailabilityStatus(payload);
      if (availabilityError) {
        return res.status(400).json({ message: availabilityError });
      }

      const existingCar = await findCarById(req.params.id);
      if (!existingCar) {
        return res.status(404).json({ message: "Car not found." });
      }

      const nextCategory = payload.category || existingCar.category || DEFAULT_CAR_CATEGORY;
      applyCategoryDefaults(payload, nextCategory);

      if (!payload.title && (payload.brand || payload.model || payload.year || payload.category)) {
        payload.title = buildCarTitle({
          brand: payload.brand || existingCar.brand,
          model: payload.model || existingCar.model,
          year: payload.year === null ? null : payload.year || existingCar.year,
          category: nextCategory
        });
      }

      const seller = await resolveSellerForCar(req.body, req.admin.id);
      payload.seller = seller._id;
      payload.location = seller.districtTown;

      const car = await updateCar(req.params.id, payload, { includeSeller: true });

      if (!car) {
        return res.status(404).json({ message: "Car not found." });
      }

      await recordAudit(req, {
        action: "car.update",
        entityType: "car",
        entityId: car._id,
        metadata: {
          updatedFields: Object.keys(payload),
          seller: seller._id
        }
      });

      return res.json(serializeAdminCar(car));
    } catch (error) {
      return sendCarError(res, error, "Could not update listing.", 400);
    }
  }
);

router.patch(
  "/:id/sold",
  requireDatabaseConnection,
  requireAdminAuth,
  requirePermission(PERMISSIONS.CARS_MARK_SOLD),
  async (req, res) => {
    try {
      const car = await markCarSold(req.params.id, true);

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
  requireDatabaseConnection,
  requireAdminAuth,
  requirePermission(PERMISSIONS.CARS_MARK_SOLD),
  async (req, res) => {
    try {
      const car = await markCarSold(req.params.id, false);

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
  requireDatabaseConnection,
  requireAdminAuth,
  requirePermission(PERMISSIONS.CARS_DELETE),
  async (req, res) => {
    try {
      const deleted = await deleteCar(req.params.id);
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
