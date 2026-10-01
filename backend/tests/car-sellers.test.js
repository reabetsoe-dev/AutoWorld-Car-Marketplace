const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeSellerPayload,
  serializeAdminCar,
  serializePublicCar,
  validateSellerPayload
} = require("../src/utils/carSellers");

test("validates dealer seller requirements and phone/email formats", () => {
  const seller = normalizeSellerPayload({
    sellerType: "Dealer",
    dealershipName: "Japan Import Centre",
    primaryPhone: "+266 6384 2459",
    whatsappNumber: "6384 2459",
    email: "sales@example.com",
    districtTown: "Maseru"
  });

  assert.deepEqual(validateSellerPayload(seller), []);
});

test("validates individual seller requirements", () => {
  const seller = normalizeSellerPayload({
    sellerType: "individual",
    ownerName: "Neo Mokoena",
    primaryPhone: "5888 1234",
    districtTown: "Leribe"
  });

  assert.deepEqual(validateSellerPayload(seller), []);
});

test("returns helpful seller validation errors", () => {
  const seller = normalizeSellerPayload({
    sellerType: "dealer",
    primaryPhone: "123",
    email: "not-an-email"
  });

  assert.deepEqual(validateSellerPayload(seller), [
    "Dealership name is required for dealer sellers.",
    "Enter a valid primary phone number.",
    "Enter a valid email address.",
    "District/town is required."
  ]);
});

test("public car serialization never exposes private seller information", () => {
  const car = {
    _id: "car123",
    title: "2020 Honda Fit Hybrid",
    brand: "Honda",
    model: "Fit Hybrid",
    category: "car",
    price: 159900,
    mileage: 58000,
    location: "Maseru",
    seller: {
      dealershipName: "Japan Import Centre",
      ownerName: "Private Owner",
      primaryPhone: "+266 6384 2459",
      whatsappNumber: "+266 6384 2459",
      email: "private@example.com",
      physicalAddress: "Exact street address",
      privateNotes: "Sensitive admin note"
    },
    createdBy: "admin123"
  };

  const publicCar = serializePublicCar(car);

  assert.equal(publicCar.location, "Maseru");
  assert.equal(publicCar.category, "car");
  assert.equal(publicCar.seller, undefined);
  assert.equal(publicCar.createdBy, undefined);
  assert.equal(JSON.stringify(publicCar).includes("6384"), false);
  assert.equal(JSON.stringify(publicCar).includes("Sensitive"), false);
});

test("admin car serialization includes private seller information", () => {
  const car = {
    _id: "car123",
    title: "2019 Honda StepWagon",
    brand: "Honda",
    price: 269900,
    mileage: 68800,
    location: "Midrand",
    seller: {
      _id: "seller123",
      sellerType: "dealer",
      dealershipName: "Japan Import Centre",
      primaryPhone: "+266 6384 2459",
      districtTown: "Midrand",
      privateNotes: "Check original auction sheet."
    }
  };

  const adminCar = serializeAdminCar(car);

  assert.equal(adminCar.seller.dealershipName, "Japan Import Centre");
  assert.equal(adminCar.seller.primaryPhone, "+266 6384 2459");
  assert.equal(adminCar.seller.privateNotes, "Check original auction sheet.");
});
