require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const AdminUser = require("../src/models/AdminUser");
const { normalizeRole } = require("../src/constants/roles");

async function seedAdmin() {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/autoworld";
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "change-me";
  const name = process.env.ADMIN_NAME || "AutoWorld Admin";
  const role = normalizeRole(process.env.ADMIN_ROLE || "manager");

  await mongoose.connect(mongoUri);

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await AdminUser.findOne({ username });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = name;
    existing.role = role;
    existing.isActive = true;
    await existing.save();
    // eslint-disable-next-line no-console
    console.log(`Updated admin user: ${username}`);
  } else {
    await AdminUser.create({
      username,
      passwordHash,
      name,
      role,
      isActive: true
    });
    // eslint-disable-next-line no-console
    console.log(`Created admin user: ${username}`);
  }

  await mongoose.disconnect();
}

seedAdmin().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to seed admin:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
