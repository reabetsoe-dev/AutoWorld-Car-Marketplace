const test = require('node:test');
const assert = require('node:assert/strict');

const { ROLES } = require('../src/constants/roles');
const { resolveAdminRoleInput } = require('../src/routes/admin');

test('disallows role escalation to admin when creating or updating admin users', () => {
  assert.equal(resolveAdminRoleInput('manager', { allowAdmin: false }), ROLES.MANAGER);
  assert.equal(resolveAdminRoleInput('editor', { allowAdmin: false }), ROLES.EDITOR);
  assert.equal(resolveAdminRoleInput('viewer', { allowAdmin: false }), ROLES.VIEWER);
  assert.throws(
    () => resolveAdminRoleInput('admin', { allowAdmin: false }),
    /admin role is not allowed/i
  );
});

test('allows admin role only for explicit bootstrap scenarios', () => {
  assert.equal(resolveAdminRoleInput('ADMIN', { allowAdmin: true }), ROLES.ADMIN);
});

test('rejects blank and unknown admin roles before hitting the database', () => {
  assert.throws(
    () => resolveAdminRoleInput('', { allowAdmin: false }),
    /role is required/i
  );
  assert.throws(
    () => resolveAdminRoleInput('superuser', { allowAdmin: false }),
    /role must be one of/i
  );
});
