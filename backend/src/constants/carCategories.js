const DEFAULT_CAR_CATEGORY = "car";

const CAR_CATEGORIES = [
  DEFAULT_CAR_CATEGORY,
  "bakkie",
  "motorcycle",
  "commercial",
  "accessory"
];

const CAR_CATEGORY_ALIASES = {
  vehicle: "car",
  vehicles: "car",
  car: "car",
  cars: "car",
  bakkie: "bakkie",
  bakkies: "bakkie",
  pickup: "bakkie",
  pickups: "bakkie",
  motorbike: "motorcycle",
  motorbikes: "motorcycle",
  motorcycle: "motorcycle",
  motorcycles: "motorcycle",
  bike: "motorcycle",
  bikes: "motorcycle",
  commercial: "commercial",
  commercial_vehicle: "commercial",
  commercial_vehicles: "commercial",
  truck: "commercial",
  trucks: "commercial",
  accessory: "accessory",
  accessories: "accessory",
  car_accessory: "accessory",
  car_accessories: "accessory"
};

function normalizeCarCategory(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return CAR_CATEGORY_ALIASES[normalized] || normalized;
}

function isCarCategory(value) {
  return CAR_CATEGORIES.includes(normalizeCarCategory(value));
}

module.exports = {
  CAR_CATEGORIES,
  DEFAULT_CAR_CATEGORY,
  isCarCategory,
  normalizeCarCategory
};
