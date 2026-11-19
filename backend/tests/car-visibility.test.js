const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

// Run against a migrated test database. All fixtures live in a session-local
// temporary table; the database's existing inventory is never changed.
test("public inventory only exposes cars added by an admin", {
  skip: !process.env.TEST_DATABASE_URL
}, async (t) => {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL,
    connectionTimeoutMillis: 5000
  });
  const database = require("../src/db");
  const originalQuery = database.query;
  const repositoryPath = require.resolve("../src/repositories/cars");
  const originalRepository = require.cache[repositoryPath];
  const adminId = randomUUID();
  const firstCarId = randomUUID();
  const secondCarId = randomUUID();
  const unownedCarId = randomUUID();
  const soldCarId = randomUUID();

  try {
    await client.connect();
    await client.query("CREATE TEMP TABLE cars (LIKE public.cars INCLUDING DEFAULTS)");
    await client.query(`
      INSERT INTO cars (id, title, brand, price, mileage, created_by, is_sold)
      VALUES
        ($1, 'Admin car one', 'Honda', 100000, 10000, $5, false),
        ($2, 'Admin car two', 'Toyota', 200000, 20000, $5, false),
        ($3, 'Unowned sample', 'Honda', 50000, 5000, NULL, false),
        ($4, 'Sold admin car', 'Honda', 300000, 30000, $5, true)
    `, [firstCarId, secondCarId, unownedCarId, soldCarId, adminId]);

    database.query = client.query.bind(client);
    delete require.cache[repositoryPath];
    const { findCarById, listCars } = require(repositoryPath);

    await t.test("pagination counts and pages only include admin inventory", async () => {
      const firstPage = await listCars({ adminCreatedOnly: true, limit: 1, sort: "priceAsc" });
      const secondPage = await listCars({ adminCreatedOnly: true, limit: 1, page: 2, sort: "priceAsc" });
      assert.equal(firstPage.pagination.total, 2);
      assert.equal(firstPage.pagination.totalPages, 2);
      assert.deepEqual(firstPage.data.map((car) => car._id), [firstCarId]);
      assert.deepEqual(secondPage.data.map((car) => car._id), [secondCarId]);
    });

    await t.test("query filters cannot expose cars without an admin creator", async () => {
      const result = await listCars({
        adminCreatedOnly: true,
        query: { brand: "Honda", includeSold: "true", adminCreatedOnly: "false" },
        sort: "priceAsc"
      });
      assert.equal(result.pagination.total, 2);
      assert.deepEqual(result.data.map((car) => car._id), [firstCarId, soldCarId]);
    });

    await t.test("public detail links cannot retrieve unowned inventory", async () => {
      assert.equal(await findCarById(unownedCarId, { adminCreatedOnly: true }), null);
      assert.equal((await findCarById(firstCarId, { adminCreatedOnly: true }))._id, firstCarId);
    });

    await t.test("admin inventory can still retrieve every listing", async () => {
      const result = await listCars({ includeSoldDefault: true });
      assert.equal(result.pagination.total, 4);
      assert.equal((await findCarById(unownedCarId))._id, unownedCarId);
    });
  } finally {
    database.query = originalQuery;
    if (originalRepository) {
      require.cache[repositoryPath] = originalRepository;
    } else {
      delete require.cache[repositoryPath];
    }
    await client.end();
  }
});
