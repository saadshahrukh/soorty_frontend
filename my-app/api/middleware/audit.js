const AuditLog = require('../models/AuditLog');

module.exports = (action, entityType) => {
  return async (req, res, next) => {
    // Log after the response
    const originalSend = res.json;
    res.json = function(data) {
      // Async logging
      if (req.user) {
        const before = res.locals.entityBefore || null;
        const after = data || null;
        const changes = req.body || {};
        // Try to attach domain-identifiers if available (Orders)
        const orderId = changes.orderId || (after && after.orderId) || (before && before.orderId);
        const productServiceName = changes.productServiceName || (after && after.productServiceName) || (before && before.productServiceName);
        AuditLog.create({
          userId: req.user._id,
          userName: req.user.name,
          action,
          entityType,
          entityId: req.params.id || (after && after._id) || (before && before._id),
          changes: { before, after, input: changes, orderId, productServiceName },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }).catch(err => console.error('Audit log error:', err));
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

