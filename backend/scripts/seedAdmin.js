require("dotenv").config();

const bcrypt = require("bcryptjs");
const { ROLE_VALUES, normalizeRole } = require("../src/constants/roles");
const { closeDatabase, connectDatabase } = require("../src/db");
const { formatErrorForLog } = require("../src/utils/errorMessages");
const {
  createAdminUser,
  findAdminByUsername,
  updateAdminUser
} = require("../src/repositories/adminUsers");

async function seedAdmin() {
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const email = String(process.env.ADMIN_EMAIL || `${username}@example.com`).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "change-me";
  const name = process.env.ADMIN_NAME || "AutoWorld Admin";
  const role = normalizeRole(process.env.ADMIN_ROLE || "manager");

  if (!ROLE_VALUES.includes(role)) {
    throw new Error(`ADMIN_ROLE must be one of: ${ROLE_VALUES.join(", ")}.`);
  }

  await connectDatabase();

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await findAdminByUsername(username);

  if (existing) {
    await updateAdminUser(existing._id, {
      passwordHash,
      email,
      name,
      role,
      isActive: true
    });
    // eslint-disable-next-line no-console
    console.log(`Updated admin user: ${username}`);
  } else {
    await createAdminUser({
      username,
      email,
      passwordHash,
      name,
      role,
      isActive: true
    });
    // eslint-disable-next-line no-console
    console.log(`Created admin user: ${username}`);
  }

  await closeDatabase();
}

seedAdmin().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to seed admin:", formatErrorForLog(error));
  await closeDatabase().catch(() => {});
  process.exit(1);
});
