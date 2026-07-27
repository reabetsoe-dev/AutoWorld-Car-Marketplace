const mongoose = require("mongoose");
const { ROLES, normalizeRole } = require("../constants/roles");

const adminUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: [ROLES.MANAGER, ROLES.EDITOR, ROLES.VIEWER, ROLES.ADMIN],
      default: ROLES.MANAGER
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

adminUserSchema.pre("save", function normalizeRoleOnSave(next) {
  this.role = normalizeRole(this.role);
  next();
});

module.exports = mongoose.model("AdminUser", adminUserSchema);
