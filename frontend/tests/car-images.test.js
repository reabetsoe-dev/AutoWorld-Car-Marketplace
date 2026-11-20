import test from "node:test";
import assert from "node:assert/strict";
import { CAR_IMAGE_PLACEHOLDER, getGalleryImages } from "../src/data/visualAssets.js";

test("a single uploaded photo stays a single-photo gallery", () => {
  const uploadedPhoto = "https://example.public.blob.vercel-storage.com/autoworld/cars/hilux.jpg";

  assert.deepEqual(getGalleryImages({ imageUrls: [uploadedPhoto] }), [uploadedPhoto]);
});

test("a gallery contains only the listing's own photos, in upload order", () => {
  const photos = ["/uploads/hilux-front.jpg", "/uploads/hilux-rear.jpg"];

  assert.deepEqual(getGalleryImages({ imageUrls: [...photos, photos[0]] }), photos);
});

test("missing or invalid photos use a neutral placeholder, never another vehicle", () => {
  for (const car of [undefined, {}, { imageUrls: [] }, { imageUrls: "invalid" },
    { imageUrls: [null, undefined, "", " ", 123] }]) {
    assert.deepEqual(getGalleryImages(car), [CAR_IMAGE_PLACEHOLDER]);
  }
});
