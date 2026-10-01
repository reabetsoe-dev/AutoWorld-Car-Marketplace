const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_CAR_CATEGORY,
  isCarCategory,
  normalizeCarCategory
} = require("../src/constants/carCategories");

test("normalizes buyer and admin category aliases", () => {
  assert.equal(DEFAULT_CAR_CATEGORY, "car");
  assert.equal(normalizeCarCategory("Vehicles"), "car");
  assert.equal(normalizeCarCategory("Motorbike"), "motorcycle");
  assert.equal(normalizeCarCategory("Commercial Vehicle"), "commercial");
  assert.equal(normalizeCarCategory("Car Accessories"), "accessory");
});

test("recognizes supported car categories", () => {
  assert.equal(isCarCategory("bakkies"), true);
  assert.equal(isCarCategory("motorcycles"), true);
  assert.equal(isCarCategory("accessories"), true);
  assert.equal(isCarCategory("boats"), false);
});
