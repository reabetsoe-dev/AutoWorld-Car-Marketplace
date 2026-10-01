const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeSellRequestPayload,
  validateSellRequestPayload
} = require("../src/routes/sellRequests");

function validPayload(overrides = {}) {
  return {
    make: "Honda",
    model: "Fit Hybrid",
    year: 2020,
    mileage: 45000,
    expectedPrice: 160000,
    condition: "good",
    fuelType: "hybrid",
    transmission: "automatic",
    location: "Maseru",
    ownerName: "Neo Mokoena",
    phone: "+266 5888 1234",
    email: "neo@example.com",
    notes: "",
    ...overrides
  };
}

test("normalizes sell request choices and text fields", () => {
  const payload = normalizeSellRequestPayload({
    make: " Honda ",
    model: " Fit Hybrid ",
    year: "2020",
    mileage: "45000",
    expectedPrice: "160000",
    condition: "Needs work",
    fuelType: " Hybrid ",
    transmission: " Automatic ",
    location: " Maseru ",
    ownerName: " Neo Mokoena ",
    phone: " +266 5888 1234 ",
    email: " NEO@EXAMPLE.COM "
  });

  assert.deepEqual(payload, validPayload({
    condition: "needs_work"
  }));
});

test("validates public sell request contact details and choices", () => {
  assert.equal(validateSellRequestPayload(validPayload(), 1), null);
  assert.equal(
    validateSellRequestPayload(validPayload({ phone: "123" }), 1),
    "Enter a valid WhatsApp number."
  );
  assert.equal(
    validateSellRequestPayload(validPayload({ email: "not-an-email" }), 1),
    "Enter a valid email address."
  );
  assert.equal(
    validateSellRequestPayload(validPayload({ fuelType: "steam" }), 1),
    "Please select a valid fuel type."
  );
});

test("does not cap public sell request image counts", () => {
  assert.equal(validateSellRequestPayload(validPayload(), 50), null);
});
