const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');
const AuditLog = require('../../../../api/models/AuditLog');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (user.role !== 'Admin') return res.status(403).json({ message: 'Access denied' });

    if (req.method === 'GET') {
      const { limit = 100 } = req.query;
      const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(parseInt(limit)).populate('userId', 'name email');
      res._jsonBody = logs;
      return res.json(logs);
    }

    if (req.method === 'DELETE') {
      const { startDate, endDate, action, entityType, userId } = req.body || {};
      const query = {};
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      if (action && ['CREATE','UPDATE','DELETE','VIEW'].includes(action)) query.action = action;
      if (entityType) query.entityType = entityType;
      if (userId) query.userId = userId;
      const result = await AuditLog.deleteMany(query);
      const out = { deletedCount: result.deletedCount || 0 };
      res._jsonBody = out;
      return res.json(out);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Users audit-logs handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
