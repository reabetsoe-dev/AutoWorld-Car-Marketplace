const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const Car = require("../models/Car");
const AdminUser = require("../models/AdminUser");
const AuditLog = require("../models/AuditLog");
const { requireAdminAuth, requirePermission } = require("../middleware/auth");
const { normalizeRole, ROLES } = require("../constants/roles");
const {
  cloudinary,
  isCloudinaryConfigured,
  bufferToDataUri
} = require("../utils/cloudinary");
const { parseCsvText } = require("../utils/csv");
const { recordAudit } = require("../utils/audit");

const router = express.Router();

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
  const title = String(readField(row, ["title"]) || "").trim();
  const brand = String(readField(row, ["brand"]) || "").trim();
  const model = String(readField(row, ["model"]) || "").trim();
  const description = String(readField(row, ["description"]) || "").trim();
  const location = String(readField(row, ["location"]) || "").trim();
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
  const mileage = numberOrUndefined(readField(row, ["mileage", "miles", "kms"]));
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
    title,
    brand,
    model: model || undefined,
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
  if (!car.title) return "title is required";
  if (!car.brand) return "brand is required";
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
    name: adminUser.name,
    role: normalizeRole(adminUser.role),
    isActive: adminUser.isActive
  };
}

router.get(
  "/stats",
  requireAdminAuth,
  requirePermission("admin:stats"),
  async (_req, res) => {
    try {
      const [summaryResult, brandBreakdown] = await Promise.all([
        Car.aggregate([
          {
            $group: {
              _id: null,
              totalCars: { $sum: 1 },
              soldCars: {
                $sum: {
                  $cond: [{ $eq: ["$isSold", true] }, 1, 0]
                }
              },
              availableCars: {
                $sum: {
                  $cond: [{ $eq: ["$isSold", false] }, 1, 0]
                }
              },
              totalInventoryValue: {
                $sum: {
                  $cond: [{ $eq: ["$isSold", false] }, "$price", 0]
                }
              },
              averagePrice: { $avg: "$price" },
              averageMileage: { $avg: "$mileage" }
            }
          }
        ]),
        Car.aggregate([
          {
            $group: {
              _id: "$brand",
              total: { $sum: 1 },
              available: {
                $sum: {
                  $cond: [{ $eq: ["$isSold", false] }, 1, 0]
                }
              },
              sold: {
                $sum: {
                  $cond: [{ $eq: ["$isSold", true] }, 1, 0]
                }
              }
            }
          },
          { $sort: { total: -1, _id: 1 } },
          { $limit: 8 }
        ])
      ]);

      const summary = summaryResult[0] || {
        totalCars: 0,
        soldCars: 0,
        availableCars: 0,
        totalInventoryValue: 0,
        averagePrice: 0,
        averageMileage: 0
      };

      return res.json({
        summary,
        brandBreakdown: brandBreakdown.map((item) => ({
          brand: item._id || "Unknown",
          total: item.total || 0,
          available: item.available || 0,
          sold: item.sold || 0
        }))
      });
    } catch (error) {
      return res.status(500).json({ message: "Could not load admin stats." });
    }
  }
);

router.post(
  "/upload-image",
  requireAdminAuth,
  requirePermission("admin:upload"),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!isCloudinaryConfigured) {
        return res.status(400).json({
          message:
            "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Please upload an image file." });
      }

      if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ message: "Only image uploads are allowed." });
      }

      const uploadFolder = process.env.CLOUDINARY_FOLDER || "autoworld/cars";
      const dataUri = bufferToDataUri(req.file);

      const result = await cloudinary.uploader.upload(dataUri, {
        folder: uploadFolder,
        resource_type: "image"
      });

      await recordAudit(req, {
        action: "admin.upload_image",
        entityType: "cloudinary_asset",
        entityId: result.public_id,
        metadata: {
          width: result.width,
          height: result.height,
          format: result.format
        }
      });

      return res.status(201).json({
        url: result.secure_url,
        publicId: result.public_id,
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
  requirePermission("admin:bulk_import"),
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

      let createdCount = 0;
      try {
        const created = await Car.insertMany(validCars, { ordered: false });
        createdCount = created.length;
      } catch (error) {
        createdCount = error.insertedDocs?.length || 0;
      }

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
  requirePermission("audit:view"),
  async (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
      const skip = (page - 1) * limit;

      const filters = {};
      if (req.query.action) {
        filters.action = new RegExp(String(req.query.action).trim(), "i");
      }
      if (req.query.actorUsername) {
        filters.actorUsername = String(req.query.actorUsername).trim().toLowerCase();
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit),
        AuditLog.countDocuments(filters)
      ]);

      return res.json({
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit))
        }
      });
    } catch (error) {
      return res.status(500).json({ message: "Could not load audit logs." });
    }
  }
);

router.get(
  "/users",
  requireAdminAuth,
  requirePermission("users:manage"),
  async (_req, res) => {
    try {
      const users = await AdminUser.find({})
        .select("_id username name role isActive createdAt updatedAt")
        .sort({ createdAt: -1 });

      return res.json({ data: users.map(sanitizeAdminUser) });
    } catch (error) {
      return res.status(500).json({ message: "Could not load admin users." });
    }
  }
);

router.post(
  "/users",
  requireAdminAuth,
  requirePermission("users:manage"),
  async (req, res) => {
    try {
      const username = String(req.body.username || "").trim().toLowerCase();
      const name = String(req.body.name || "").trim();
      const password = String(req.body.password || "");
      const role = normalizeRole(req.body.role || ROLES.EDITOR);

      if (!username || !name || !password) {
        return res
          .status(400)
          .json({ message: "username, name, and password are required." });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
      }

      const exists = await AdminUser.findOne({ username });
      if (exists) {
        return res.status(409).json({ message: "Username already exists." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const created = await AdminUser.create({
        username,
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
  requirePermission("users:manage"),
  async (req, res) => {
    try {
      const update = {};
      if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
        update.name = String(req.body.name || "").trim();
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "role")) {
        update.role = normalizeRole(req.body.role);
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
      }

      const user = await AdminUser.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true
      });
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
