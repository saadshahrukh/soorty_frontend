const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const AuditLog = require('../../models/AuditLog');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  const items = await AuditLog.find().sort({ createdAt: -1 }).limit(200);
  return res.json(items);
};
