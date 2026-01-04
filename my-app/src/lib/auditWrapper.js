const AuditLog = require('../../api/models/AuditLog');

function withAudit(action, entityType, handler) {
  return async (req, res) => {
    // allow handler to run and optionally set res.locals.entityBefore
    await handler(req, res);
    try {
      if (!req.user) return;
      const before = res.locals && res.locals.entityBefore ? res.locals.entityBefore : null;
      // attempt to parse the response body if handler put it on res._jsonBody
      const after = res._jsonBody !== undefined ? res._jsonBody : null;
      const changes = req.body || {};
      const orderId = changes.orderId || (after && after.orderId) || (before && before.orderId);
      const productServiceName = changes.productServiceName || (after && after.productServiceName) || (before && before.productServiceName);
      AuditLog.create({
        userId: req.user._id,
        userName: req.user.name,
        action,
        entityType,
        entityId: (req.query && req.query.id) || (after && after._id) || (before && before._id) || null,
        changes: { before, after, input: changes, orderId, productServiceName },
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'] || ''
      }).catch(err => console.error('Audit log error:', err));
    } catch (e) {
      console.error('Audit wrapper error:', e);
    }
  };
}

module.exports = { withAudit };
