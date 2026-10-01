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

    email: {
  type: String,
  required: true,
  unique: true,
  trim: true,
  lowercase: true,
  match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
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
      enum: [
        ROLES.MANAGER,
        ROLES.EDITOR,
        ROLES.VIEWER,
        ROLES.ADMIN
      ],
      default: ROLES.MANAGER
    },

    isActive: {
      type: Boolean,
      default: true
    },

    lastLogin: {
      type: Date,
      default: null
    },

    passwordChangedAt: {
      type: Date,
      default: Date.now
    },

    failedLoginAttempts: {
      type: Number,
      default: 0
    },

    lockUntil: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

adminUserSchema.pre("save", function (next) {
  this.role = normalizeRole(this.role);
  next();
});

module.exports = mongoose.model("AdminUser", adminUserSchema);