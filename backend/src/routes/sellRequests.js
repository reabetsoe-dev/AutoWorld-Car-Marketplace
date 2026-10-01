const express = require("express");
const multer = require("multer");
const { requireAdminAuth } = require("../middleware/auth");
const { requireDatabaseConnection } = require("../middleware/database");
const { requirePermission } = require("../middleware/permissions");
const { PERMISSIONS } = require("../constants/roles");
const { recordAudit } = require("../utils/audit");
const { EMAIL_REGEX, PHONE_REGEX } = require("../utils/carSellers");
const {
  deleteStoredImages,
  imageStorageMissingMessage,
  isImageStorageConfigured,
  uploadImageFile
} = require("../utils/imageStorage");
const {
  createSellRequest,
  listSellRequests,
  updateSellRequest
} = require("../repositories/sellRequests");

const router = express.Router();

const ALLOWED_CONDITIONS = ["excellent", "good", "fair", "needs_work"];
const ALLOWED_FUEL_TYPES = ["petrol", "diesel", "hybrid", "electric"];
const ALLOWED_TRANSMISSIONS = ["automatic", "manual"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      const error = new Error("Only image uploads are allowed.");
      error.statusCode = 400;
      return callback(error);
    }
    return callback(null, true);
  }
});

const ALLOWED_STATUS = ["new", "reviewing", "contacted", "converted", "declined"];

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeChoice(value, fallback, map = {}) {
  const normalized = cleanText(value).toLowerCase().replace(/\s+/g, "_");
  return map[normalized] || normalized || fallback;
}

function resolveSellRequestFolder() {
  return process.env.BLOB_SELL_REQUEST_FOLDER || process.env.CLOUDINARY_SELL_REQUEST_FOLDER || "autoworld/sell-requests";
}

async function uploadSellRequestImages(files = []) {
  return Promise.all(
    files.map(async (file) => {
      const result = await uploadImageFile(file, {
        folder: resolveSellRequestFolder()
      });

      return {
        provider: result.provider,
        url: result.url,
        filename: result.filename,
        publicId: result.publicId,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        width: result.width,
        height: result.height,
        format: result.format
      };
    })
  );
}

function normalizeSellRequestPayload(body) {
  return {
    make: cleanText(body.make),
    model: cleanText(body.model),
    year: numberOrUndefined(body.year),
    mileage: numberOrUndefined(body.mileage),
    expectedPrice: numberOrUndefined(body.expectedPrice),
    condition: normalizeChoice(body.condition, "good", {
      "needs work": "needs_work"
    }),
    fuelType: normalizeChoice(body.fuelType, "petrol"),
    transmission: normalizeChoice(body.transmission, "automatic"),
    location: cleanText(body.location),
    ownerName: cleanText(body.ownerName),
    phone: cleanText(body.phone),
    email: cleanText(body.email).toLowerCase(),
    notes: cleanText(body.notes)
  };
}

function validateSellRequestPayload(payload, imageCount) {
  const requiredFields = ["make", "model", "year", "mileage", "location", "ownerName", "phone"];
  const missingField = requiredFields.find((field) => payload[field] === undefined || payload[field] === "");

  if (missingField) {
    return "Please complete the required car and contact details.";
  }
  if (payload.year < 1900 || payload.year > 2100) {
    return "Please enter a valid vehicle year.";
  }
  if (payload.mileage < 0) {
    return "Mileage cannot be negative.";
  }
  if (payload.expectedPrice !== undefined && payload.expectedPrice < 0) {
    return "Expected price cannot be negative.";
  }
  if (!PHONE_REGEX.test(payload.phone)) {
    return "Enter a valid WhatsApp number.";
  }
  if (payload.email && !EMAIL_REGEX.test(payload.email)) {
    return "Enter a valid email address.";
  }
  if (!ALLOWED_CONDITIONS.includes(payload.condition)) {
    return "Please select a valid vehicle condition.";
  }
  if (!ALLOWED_FUEL_TYPES.includes(payload.fuelType)) {
    return "Please select a valid fuel type.";
  }
  if (!ALLOWED_TRANSMISSIONS.includes(payload.transmission)) {
    return "Please select a valid transmission.";
  }
  if (imageCount < 1) {
    return "Please upload at least one vehicle image.";
  }
  return null;
}

router.use(requireDatabaseConnection);

router.post("/", upload.array("images"), async (req, res) => {
  const files = req.files || [];
  let images = [];

  try {
    const payload = normalizeSellRequestPayload(req.body || {});
    const validationError = validateSellRequestPayload(payload, files.length);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    if (!isImageStorageConfigured()) {
      return res.status(400).json({
        message: imageStorageMissingMessage()
      });
    }

    images = await uploadSellRequestImages(files);

    const request = await createSellRequest({
      ...payload,
      images
    });

    await recordAudit(req, {
      action: "sell_request.create",
      entityType: "sell_request",
      entityId: request._id,
      metadata: {
        make: request.make,
        model: request.model,
        imageCount: request.images.length
      }
    });

    return res.status(201).json({ request });
  } catch (error) {
    await deleteStoredImages(images);
    return res.status(500).json({ message: "Could not submit sell request." });
  }
});

router.get(
  "/admin/all",
  requireAdminAuth,
  requirePermission(PERMISSIONS.SELL_REQUESTS_VIEW),
  async (req, res) => {
    try {
      return res.json(await listSellRequests({
        page: req.query.page,
        limit: req.query.limit,
        query: req.query
      }));
    } catch (error) {
      return res.status(500).json({ message: "Could not load sell requests." });
    }
  }
);

router.patch(
  "/admin/:id",
  requireAdminAuth,
  requirePermission(PERMISSIONS.SELL_REQUESTS_UPDATE),
  async (req, res) => {
    try {
      const update = {};

      if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
        const status = cleanText(req.body.status).toLowerCase();
        if (!ALLOWED_STATUS.includes(status)) {
          return res.status(400).json({ message: "Invalid sell request status." });
        }
        update.status = status;
        update.reviewedAt = new Date();
        update.reviewedBy = req.admin.id;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "adminNotes")) {
        update.adminNotes = cleanText(req.body.adminNotes);
      }

      const request = await updateSellRequest(req.params.id, update);

      if (!request) {
        return res.status(404).json({ message: "Sell request not found." });
      }

      await recordAudit(req, {
        action: "sell_request.update",
        entityType: "sell_request",
        entityId: request._id,
        metadata: {
          updatedFields: Object.keys(update),
          status: request.status
        }
      });

      return res.json({ request });
    } catch (error) {
      return res.status(400).json({ message: "Could not update sell request." });
    }
  }
);

module.exports = router;
module.exports.normalizeSellRequestPayload = normalizeSellRequestPayload;
module.exports.validateSellRequestPayload = validateSellRequestPayload;
