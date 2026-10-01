const test = require("node:test");
const assert = require("node:assert/strict");

const { buildCarTitle } = require("../src/utils/carTitles");

test("builds listing titles from existing vehicle fields", () => {
  assert.equal(
    buildCarTitle({ year: 2021, brand: "Toyota", model: "Aqua Hybrid" }),
    "2021 Toyota Aqua Hybrid"
  );
});

test("falls back cleanly for accessory listings", () => {
  assert.equal(buildCarTitle({ brand: "Thule", model: "Roof rack" }), "Thule Roof rack");
  assert.equal(buildCarTitle({ category: "accessory" }), "Accessory listing");
});
