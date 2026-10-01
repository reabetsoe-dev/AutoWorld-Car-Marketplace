const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPoolConfig,
  isPostgresConnectionError,
  resolveDatabaseUrl
} = require('../src/db');

test('resolves PostgreSQL database URL from DATABASE_URL', () => {
  const env = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/autoworld'
  };

  assert.equal(resolveDatabaseUrl(env), env.DATABASE_URL);
});

test('builds PostgreSQL pool config and enables SSL only when requested', () => {
  const config = buildPoolConfig({
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/autoworld',
    PGSSL: 'false',
    PG_POOL_MAX: '3'
  });

  assert.equal(config.connectionString, 'postgresql://postgres:postgres@localhost:5432/autoworld');
  assert.equal(config.max, 3);
  assert.equal(config.ssl, undefined);
});

test('requires DATABASE_URL for PostgreSQL connection config', () => {
  assert.throws(() => buildPoolConfig({}), /DATABASE_URL/i);
});

test('classifies connection failures separately from query validation errors', () => {
  assert.equal(isPostgresConnectionError({ code: 'ECONNREFUSED' }), true);
  assert.equal(isPostgresConnectionError({ code: '08006' }), true);
  assert.equal(
    isPostgresConnectionError({ message: 'Connection terminated unexpectedly' }),
    true
  );
  assert.equal(isPostgresConnectionError({ code: '22P02' }), false);
  assert.equal(isPostgresConnectionError({ code: '23514' }), false);
});
