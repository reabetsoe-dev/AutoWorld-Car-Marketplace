const path = require("path");
const crypto = require("crypto");
const {
  cloudinary,
  isCloudinaryConfigured,
  bufferToDataUri
} = require("./cloudinary");

function isVercelBlobConfigured(env = process.env) {
  return Boolean(env.BLOB_STORE_ID || env.BLOB_READ_WRITE_TOKEN);
}

function isImageStorageConfigured(env = process.env) {
  return isVercelBlobConfigured(env) || isCloudinaryConfigured;
}

function imageStorageMissingMessage() {
  return "Image storage is not configured. Connect Vercel Blob or set Cloudinary credentials.";
}

function safePathSegment(value, fallback = "upload") {
  return String(value || fallback)
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("/") || fallback;
}

function safeFilename(file) {
  const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
  const base = path
    .basename(file.originalname || "image", extension)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";

  return `${Date.now()}-${crypto.randomUUID()}-${base}${extension}`;
}

async function uploadToVercelBlob(file, options = {}) {
  const { put } = await import("@vercel/blob");
  const folder = safePathSegment(options.folder || "autoworld/uploads");
  const pathname = `${folder}/${safeFilename(file)}`;
  const blob = await put(pathname, file.buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.mimetype || undefined
  });

  return {
    provider: "vercel_blob",
    url: blob.url,
    publicId: blob.pathname,
    filename: blob.pathname,
    originalName: file.originalname,
    mimetype: blob.contentType || file.mimetype,
    size: file.size,
    width: null,
    height: null,
    format: blob.contentType || file.mimetype || null
  };
}

async function uploadToCloudinary(file, options = {}) {
  const result = await cloudinary.uploader.upload(bufferToDataUri(file), {
    folder: options.folder || "autoworld/cars",
    resource_type: "image"
  });

  return {
    provider: "cloudinary",
    url: result.secure_url,
    publicId: result.public_id,
    filename: result.public_id,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    width: result.width,
    height: result.height,
    format: result.format
  };
}

async function uploadImageFile(file, options = {}) {
  if (isVercelBlobConfigured()) {
    return uploadToVercelBlob(file, options);
  }

  if (isCloudinaryConfigured) {
    return uploadToCloudinary(file, options);
  }

  throw new Error(imageStorageMissingMessage());
}

async function deleteStoredImage(image = {}) {
  if (!image.publicId && !image.url) {
    return;
  }

  if (image.provider === "vercel_blob" || /blob\.vercel-storage\.com/.test(image.url || "")) {
    const { del } = await import("@vercel/blob");
    await del(image.url || image.publicId);
    return;
  }

  await cloudinary.uploader.destroy(image.publicId);
}

async function deleteStoredImages(images = []) {
  await Promise.all(
    images.map((image) =>
      deleteStoredImage(image).catch(() => {
        // Best effort cleanup only.
      })
    )
  );
}

module.exports = {
  deleteStoredImages,
  imageStorageMissingMessage,
  isImageStorageConfigured,
  isVercelBlobConfigured,
  uploadImageFile
};
