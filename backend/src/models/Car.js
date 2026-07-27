const mongoose = require("mongoose");

const carSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    brand: {
      type: String,
      required: true,
      trim: true
    },
    model: {
      type: String,
      trim: true
    },
    year: {
      type: Number,
      min: 1900,
      max: 2100
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    mileage: {
      type: Number,
      required: true,
      min: 0
    },
    fuelType: {
      type: String,
      enum: ["petrol", "diesel", "hybrid", "electric", "other"],
      default: "other"
    },
    transmission: {
      type: String,
      enum: ["manual", "automatic", "other"],
      default: "other"
    },
    description: {
      type: String,
      trim: true
    },
    imageUrls: {
      type: [String],
      default: []
    },
    location: {
      type: String,
      trim: true
    },
    isAuction: {
      type: Boolean,
      default: false,
      index: true
    },
    isSpecialOffer: {
      type: Boolean,
      default: false,
      index: true
    },
    isSold: {
      type: Boolean,
      default: false,
      index: true
    },
    soldAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser"
    }
  },
  { timestamps: true }
);

carSchema.index({ brand: 1, price: 1, mileage: 1, createdAt: -1 });
carSchema.index({ isAuction: 1, isSpecialOffer: 1, isSold: 1, createdAt: -1 });

module.exports = mongoose.model("Car", carSchema);
