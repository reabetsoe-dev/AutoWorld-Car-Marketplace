const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { requireAdminAuth } = require("../middleware/auth");
const { requireDatabaseConnection } = require("../middleware/database");
const { requirePermission } = require("../middleware/permissions");
const { isKnownRole, normalizeRole, ROLES, PERMISSIONS } = require("../constants/roles");
const {
  imageStorageMissingMessage,
  isImageStorageConfigured,
  uploadImageFile
} = require("../utils/imageStorage");
const { parseCsvText } = require("../utils/csv");
const { recordAudit } = require("../utils/audit");
const { buildCarTitle } = require("../utils/carTitles");
const {
  DEFAULT_CAR_CATEGORY,
  isCarCategory,
  normalizeCarCategory
} = require("../constants/carCategories");
const {
  getCarStats,
  insertManyCars
} = require("../repositories/cars");
const {
  createAdminUser,
  findAdminByEmail,
  findAdminById,
  findAdminByUsername,
  listAdminUsers,
  updateAdminUser
} = require("../repositories/adminUsers");
const { listAuditLogs } = require("../repositories/auditLogs");

const router = express.Router();

router.use(requireDatabaseConnection);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanFromValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y", "sold", "auction", "special", "specialoffer"].includes(normalized);
}

function splitImageUrls(value) {
  if (!value) return [];
  return String(value)
    .split(/[|;]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readField(row, candidates) {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) {
      return row[candidate];
    }
  }
  return undefined;
}

function normalizeCsvCar(row, createdBy) {
  const brand = String(readField(row, ["brand"]) || "").trim();
  const model = String(readField(row, ["model"]) || "").trim();
  const description = String(readField(row, ["description"]) || "").trim();
  const location = String(readField(row, ["location"]) || "").trim();
  const category =
    normalizeCarCategory(readField(row, ["category", "vehiclecategory", "vehicle_category", "type"])) ||
    DEFAULT_CAR_CATEGORY;
  const fuelType = String(
    readField(row, ["fueltype", "fuel_type", "fuel"]) || "other"
  )
    .trim()
    .toLowerCase();
  const transmission = String(
    readField(row, ["transmission", "gearbox"]) || "other"
  )
    .trim()
    .toLowerCase();
  const year = numberOrUndefined(readField(row, ["year"]));
  const price = numberOrUndefined(readField(row, ["price"]));
  let mileage = numberOrUndefined(readField(row, ["mileage", "miles", "kms"]));
  if (category === "accessory" && mileage === undefined) {
    mileage = 0;
  }
  const imageUrls = splitImageUrls(
    readField(row, ["imageurls", "image_urls", "images", "image"])
  );
  const isSold = booleanFromValue(readField(row, ["issold", "is_sold", "status"]), false);
  const isAuction = booleanFromValue(
    readField(row, ["isauction", "is_auction", "auction"]),
    false
  );
  const isSpecialOffer = booleanFromValue(
    readField(row, ["isspecialoffer", "is_special_offer", "specialoffer", "special_offer"]),
    false
  );

  return {
    title:
      String(readField(row, ["title"]) || "").trim() ||
      buildCarTitle({ year, brand, model, category }),
    brand,
    model: model || undefined,
    category,
    description: description || undefined,
    location: location || undefined,
    fuelType,
    transmission,
    year,
    price,
    mileage,
    imageUrls,
    isAuction,
    isSpecialOffer,
    isSold,
    soldAt: isSold ? new Date() : null,
    createdBy
  };
}

function validateCsvCar(car) {
  if (!car.brand) return "brand is required";
  if (!isCarCategory(car.category)) {
    return "category must be one of: car, bakkie, motorcycle, commercial, accessory";
  }
  if (car.price === undefined) return "price is required";
  if (car.mileage === undefined) return "mileage is required";
  if (car.price < 0) return "price cannot be negative";
  if (car.mileage < 0) return "mileage cannot be negative";
  return null;
}

function sanitizeAdminUser(adminUser) {
  return {
    id: adminUser._id,
    username: adminUser.username,
    email: adminUser.email,
    name: adminUser.name,
    role: normalizeRole(adminUser.role),
    isActive: Boolean(adminUser.isActive),
    lastLogin: adminUser.lastLogin || null
  };
}

function resolveAdminRoleInput(inputRole, options = {}) {
  if (!String(inputRole || "").trim()) {
    throw new Error("Role is required.");
  }

  const normalizedRole = normalizeRole(inputRole);
  const allowAdmin = options.allowAdmin === true;

  if (normalizedRole === ROLES.ADMIN && !allowAdmin) {
    throw new Error("Admin role is not allowed for this operation.");
  }

  if (!isKnownRole(normalizedRole)) {
    const allowedRoles = allowAdmin
      ? Object.values(ROLES)
      : [ROLES.MANAGER, ROLES.EDITOR, ROLES.VIEWER];
    throw new Error(`Role must be one of: ${allowedRoles.join(", ")}.`);
  }

  return normalizedRole;
}

router.get(
  "/stats",
  requireAdminAuth,
  requirePermission(PERMISSIONS.ADMIN_STATS),
  async (req, res) => {
    try {
      return res.json(await getCarStats({ query: req.query }));
    } catch (error) {
      return res.status(500).json({ message: "Could not load admin stats." });
    }
  }
);

router.post(
  "/upload-image",
  requireAdminAuth,
  requirePermission(PERMISSIONS.ADMIN_UPLOAD),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!isImageStorageConfigured()) {
        return res.status(400).json({
          message: imageStorageMissingMessage()
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Please upload an image file." });
      }

      if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ message: "Only image uploads are allowed." });
      }

      const result = await uploadImageFile(req.file, {
        folder: process.env.BLOB_CAR_IMAGE_FOLDER || process.env.CLOUDINARY_FOLDER || "autoworld/cars"
      });

      await recordAudit(req, {
        action: "admin.upload_image",
        entityType: "image_asset",
        entityId: result.publicId,
        metadata: {
          provider: result.provider,
          width: result.width,
          height: result.height,
          format: result.format
        }
      });

      return res.status(201).json({
        url: result.url,
        publicId: result.publicId,
        filename: result.filename,
        provider: result.provider,
        width: result.width,
        height: result.height,
        format: result.format
      });
    } catch (error) {
      return res.status(500).json({ message: "Image upload failed." });
    }
  }
);

router.post(
  "/bulk-import",
  requireAdminAuth,
  requirePermission(PERMISSIONS.ADMIN_BULK_IMPORT),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required." });
      }

      const text = req.file.buffer.toString("utf8");
      const { headers, rows } = parseCsvText(text);

      if (rows.length === 0) {
        return res.status(400).json({ message: "CSV file has no data rows." });
      }

      const requiredHeaders = ["title", "brand", "price", "mileage"];
      const missingHeaders = requiredHeaders.filter(
        (header) => !headers.includes(header)
      );
      if (missingHeaders.length > 0) {
        return res.status(400).json({
          message: `Missing required CSV headers: ${missingHeaders.join(", ")}`
        });
      }

      const validCars = [];
      const failedRows = [];

      rows.forEach((row, index) => {
        const normalized = normalizeCsvCar(row, req.admin.id);
        const errorMessage = validateCsvCar(normalized);
        if (errorMessage) {
          failedRows.push({
            rowNumber: index + 2,
            reason: errorMessage,
            raw: row
          });
        } else {
          validCars.push(normalized);
        }
      });

      if (validCars.length === 0) {
        return res.status(400).json({
          message: "No valid rows found in CSV.",
          createdCount: 0,
          failedCount: failedRows.length,
          failedRows: failedRows.slice(0, 25)
        });
      }

      const createdCount = await insertManyCars(validCars);

      await recordAudit(req, {
        action: "car.bulk_import",
        entityType: "car",
        metadata: {
          createdCount,
          failedCount: failedRows.length,
          totalRows: rows.length
        }
      });

      return res.status(201).json({
        message: "Bulk import processed.",
        createdCount,
        failedCount: failedRows.length,
        failedRows: failedRows.slice(0, 25)
      });
    } catch (error) {
      return res.status(500).json({ message: "Bulk import failed." });
    }
  }
);

router.get(
  "/audit-logs",
  requireAdminAuth,
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  async (req, res) => {
    try {
      return res.json(await listAuditLogs({
        page: req.query.page,
        limit: req.query.limit,
        action: req.query.action,
        actorUsername: req.query.actorUsername,
        createdFrom: req.query.createdFrom,
        createdTo: req.query.createdTo
      }));
    } catch (error) {
      return res.status(500).json({ message: "Could not load audit logs." });
    }
  }
);

router.get(
  "/users",
  requireAdminAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (_req, res) => {
    try {
      const users = await listAdminUsers();
      return res.json({ data: users.map(sanitizeAdminUser) });
    } catch (error) {
      return res.status(500).json({ message: "Could not load admin users." });
    }
  }
);

router.post(
  "/users",
  requireAdminAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req, res) => {
    try {
      const username = String(req.body.username || "").trim().toLowerCase();
      const email = String(req.body.email || "").trim().toLowerCase();
      const name = String(req.body.name || "").trim();
      const password = String(req.body.password || "");
      let role;
      try {
        role = resolveAdminRoleInput(req.body.role || ROLES.EDITOR, {
          allowAdmin: false
        });
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }

      if (!username || !email || !name || !password) {
        return res
          .status(400)
          .json({ message: "username, email, name, and password are required." });
      }

      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Please provide a valid email address." });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
      }

      const [existingUsername, existingEmail] = await Promise.all([
        findAdminByUsername(username),
        findAdminByEmail(email)
      ]);

      if (existingUsername) {
        return res.status(409).json({ message: "Username already exists." });
      }

      if (existingEmail) {
        return res.status(409).json({ message: "Email already exists." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const created = await createAdminUser({
        username,
        email,
        name,
        passwordHash,
        role,
        isActive: true
      });

      await recordAudit(req, {
        action: "admin_user.create",
        entityType: "admin_user",
        entityId: created._id,
        metadata: {
          username: created.username,
          email: created.email,
          role: created.role
        }
      });

      return res.status(201).json({ user: sanitizeAdminUser(created) });
    } catch (error) {
      return res.status(500).json({ message: "Could not create admin user." });
    }
  }
);

router.patch(
  "/users/:id",
  requireAdminAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req, res) => {
    try {
      const update = {};
      if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
        update.name = String(req.body.name || "").trim();
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "role")) {
        try {
          update.role = resolveAdminRoleInput(req.body.role, {
            allowAdmin: false
          });
        } catch (error) {
          return res.status(400).json({ message: error.message });
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
        update.isActive = Boolean(req.body.isActive);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "password")) {
        const password = String(req.body.password || "");
        if (password.length < 8) {
          return res
            .status(400)
            .json({ message: "Password must be at least 8 characters." });
        }
        update.passwordHash = await bcrypt.hash(password, 10);
        update.passwordChangedAt = new Date();
      }

      const existingUser = await findAdminById(req.params.id);
      if (!existingUser) {
        return res.status(404).json({ message: "Admin user not found." });
      }

      const user = await updateAdminUser(req.params.id, update);
      if (!user) {
        return res.status(404).json({ message: "Admin user not found." });
      }

      await recordAudit(req, {
        action: "admin_user.update",
        entityType: "admin_user",
        entityId: user._id,
        metadata: {
          updatedFields: Object.keys(update)
        }
      });

      return res.json({ user: sanitizeAdminUser(user) });
    } catch (error) {
      return res.status(400).json({ message: "Could not update admin user." });
    }
  }
);

module.exports = router;
module.exports.sanitizeAdminUser = sanitizeAdminUser;
module.exports.resolveAdminRoleInput = resolveAdminRoleInput;
