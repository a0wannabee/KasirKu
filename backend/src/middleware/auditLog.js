const prisma = require('../config/prisma');

/**
 * Writes an immutable audit trail entry. AuditLog rows are never updated or
 * deleted by application code — there is intentionally no update()/delete()
 * call against this model anywhere in the codebase.
 *
 * Call this explicitly inside controllers for every sensitive mutation:
 * product create/update, HPP change, stock adjustment, sale void, user
 * role change, login, etc.
 */
async function writeAuditLog({ req, action, entityType, entityId, before = null, after = null }) {
  await prisma.auditLog.create({
    data: {
      userId: req.user ? req.user.id : null,
      action,
      entityType,
      entityId: String(entityId),
      beforeData: before,
      afterData: after,
      ipAddress: req.ip,
    },
  });
}

module.exports = { writeAuditLog };
