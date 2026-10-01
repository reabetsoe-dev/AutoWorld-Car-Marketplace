const PHONE_REGEX = /^\+?[\d\s().-]{7,24}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SELLER_TYPES = ["dealer", "individual"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUBLIC_CAR_FIELDS = [
  "_id",
  "title",
  "brand",
  "model",
  "category",
  "year",
  "price",
  "mileage",
  "availabilityStatus",
  "fuelType",
  "transmission",
  "description",
  "imageUrls",
  "location",
  "isAuction",
  "isSpecialOffer",
  "isSold",
  "soldAt",
  "createdAt",
  "updatedAt"
];

function cleanText(value, preserveBlank = false) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || (preserveBlank ? "" : undefined);
}

function cleanLowerText(value, preserveBlank = false) {
  const trimmed = cleanText(value, preserveBlank);
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function readTextField(input, field, lower = false) {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return undefined;
  return lower ? cleanLowerText(input[field], true) : cleanText(input[field], true);
}

function toPlainDoc(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === "function") {
    return doc.toObject({ virtuals: false });
  }
  return doc;
}

function normalizeSellerPayload(input = {}) {
  return {
    sellerType: readTextField(input, "sellerType", true) || readTextField(input, "type", true),
    dealershipName: readTextField(input, "dealershipName"),
    ownerName: readTextField(input, "ownerName"),
    contactPerson: readTextField(input, "contactPerson"),
    primaryPhone: readTextField(input, "primaryPhone"),
    whatsappNumber: readTextField(input, "whatsappNumber"),
    email: readTextField(input, "email", true),
    districtTown: readTextField(input, "districtTown"),
    physicalAddress: readTextField(input, "physicalAddress"),
    privateNotes: readTextField(input, "privateNotes")
  };
}

function validateSellerPayload(payload) {
  const errors = [];
  const sellerType = payload.sellerType;

  if (!SELLER_TYPES.includes(sellerType)) {
    errors.push("Seller type is required and must be Dealer or Individual.");
  }

  if (sellerType === "dealer" && !payload.dealershipName) {
    errors.push("Dealership name is required for dealer sellers.");
  }

  if (sellerType === "individual" && !payload.ownerName) {
    errors.push("Owner's full name is required for individual sellers.");
  }

  if (!payload.primaryPhone) {
    errors.push("Primary phone number is required.");
  } else if (!PHONE_REGEX.test(payload.primaryPhone)) {
    errors.push("Enter a valid primary phone number.");
  }

  if (payload.whatsappNumber && !PHONE_REGEX.test(payload.whatsappNumber)) {
    errors.push("Enter a valid WhatsApp number.");
  }

  if (payload.email && !EMAIL_REGEX.test(payload.email)) {
    errors.push("Enter a valid email address.");
  }

  if (!payload.districtTown) {
    errors.push("District/town is required.");
  }

  return errors;
}

function normalizeSellerId(value) {
  const id = cleanText(value);
  if (!id) return undefined;
  return UUID_REGEX.test(id) ? id : null;
}

function serializeAdminSeller(seller) {
  const plain = toPlainDoc(seller);
  if (!plain) return null;

  return {
    _id: plain._id,
    sellerType: plain.sellerType,
    dealershipName: plain.dealershipName || "",
    ownerName: plain.ownerName || "",
    contactPerson: plain.contactPerson || "",
    primaryPhone: plain.primaryPhone || "",
    whatsappNumber: plain.whatsappNumber || "",
    email: plain.email || "",
    districtTown: plain.districtTown || "",
    physicalAddress: plain.physicalAddress || "",
    privateNotes: plain.privateNotes || "",
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

function serializePublicCar(car) {
  const plain = toPlainDoc(car);
  if (!plain) return null;

  return PUBLIC_CAR_FIELDS.reduce((safe, field) => {
    if (Object.prototype.hasOwnProperty.call(plain, field)) {
      safe[field] = plain[field];
    }
    return safe;
  }, {});
}

function serializeAdminCar(car) {
  const plain = toPlainDoc(car);
  if (!plain) return null;

  return {
    ...serializePublicCar(plain),
    createdBy: plain.createdBy,
    seller: serializeAdminSeller(plain.seller)
  };
}

module.exports = {
  PHONE_REGEX,
  EMAIL_REGEX,
  SELLER_TYPES,
  normalizeSellerPayload,
  normalizeSellerId,
  validateSellerPayload,
  serializeAdminSeller,
  serializePublicCar,
  serializeAdminCar
};
