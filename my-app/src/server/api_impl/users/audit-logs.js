const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const AuditLog = require('../../models/AuditLog');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  
  if (req.method === 'GET') {
    const items = await AuditLog.find().sort({ createdAt: -1 }).limit(200);
    res._jsonBody = items;
    return res.json(items);
  }
  
  if (req.method === 'DELETE') {
    // Delete audit logs based on criteria from request body
    const { before, userId } = req.body || {};
    const query = {};
    if (before) query.createdAt = { $lt: new Date(before) };
    if (userId) query.userId = userId;
    
    const result = await AuditLog.deleteMany(query);
    return res.json({ message: 'Deleted', deletedCount: result.deletedCount });
  }
  
  return res.status(405).json({ message: 'Method not allowed' });
};

