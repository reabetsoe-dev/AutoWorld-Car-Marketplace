const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorAdminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      index: true
    },
    actorName: {
      type: String,
      trim: true
    },
    actorUsername: {
      type: String,
      trim: true,
      lowercase: true
    },
    actorRole: {
      type: String,
      trim: true,
      lowercase: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    entityType: {
      type: String,
      trim: true,
      index: true
    },
    entityId: {
      type: String,
      trim: true,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
