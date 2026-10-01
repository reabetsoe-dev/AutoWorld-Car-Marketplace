const DEFAULT_ACCESSORY_AVAILABILITY = "readily_available";

const ACCESSORY_AVAILABILITY_STATUSES = [
  DEFAULT_ACCESSORY_AVAILABILITY,
  "on_order"
];

const ACCESSORY_AVAILABILITY_ALIASES = {
  available: DEFAULT_ACCESSORY_AVAILABILITY,
  in_stock: DEFAULT_ACCESSORY_AVAILABILITY,
  ready: DEFAULT_ACCESSORY_AVAILABILITY,
  readily_available: DEFAULT_ACCESSORY_AVAILABILITY,
  readly_available: DEFAULT_ACCESSORY_AVAILABILITY,
  on_order: "on_order",
  ordered: "on_order",
  order: "on_order",
  special_order: "on_order"
};

function normalizeAccessoryAvailability(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return ACCESSORY_AVAILABILITY_ALIASES[normalized] || normalized;
}

function isAccessoryAvailability(value) {
  return ACCESSORY_AVAILABILITY_STATUSES.includes(normalizeAccessoryAvailability(value));
}

module.exports = {
  ACCESSORY_AVAILABILITY_STATUSES,
  DEFAULT_ACCESSORY_AVAILABILITY,
  isAccessoryAvailability,
  normalizeAccessoryAvailability
};
