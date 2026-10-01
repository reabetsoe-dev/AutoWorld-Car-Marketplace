const test = require('node:test');
const assert = require('node:assert/strict');

const { ROLES, PERMISSIONS, normalizeRole, hasPermission } = require('../src/constants/roles');
const { sanitizeAdmin } = require('../src/routes/auth');

test('normalizeRole keeps admin independent from manager', () => {
  assert.equal(normalizeRole('ADMIN'), ROLES.ADMIN);
  assert.equal(normalizeRole('Manager'), ROLES.MANAGER);
  assert.equal(normalizeRole('manager'), ROLES.MANAGER);
});

test('admin permissions include system settings while manager does not', () => {
  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.SYSTEM_SETTINGS), true);
  assert.equal(hasPermission(ROLES.MANAGER, PERMISSIONS.SYSTEM_SETTINGS), false);
});

test('sanitizeAdmin exposes intended fields and omits sensitive ones', () => {
  const sanitized = sanitizeAdmin({
    _id: 'abc123',
    username: 'superadmin',
    email: 'admin@example.com',
    name: 'Super Admin',
    role: 'admin',
    isActive: true,
    lastLogin: new Date('2024-01-01T00:00:00.000Z'),
    passwordHash: 'secret',
    failedLoginAttempts: 3,
    lockUntil: new Date('2024-01-02T00:00:00.000Z'),
    passwordChangedAt: new Date('2024-01-01T00:00:00.000Z')
  });

  assert.deepEqual(sanitized, {
    id: 'abc123',
    username: 'superadmin',
    email: 'admin@example.com',
    name: 'Super Admin',
    role: ROLES.ADMIN,
    isActive: true,
    lastLogin: new Date('2024-01-01T00:00:00.000Z')
  });
});
