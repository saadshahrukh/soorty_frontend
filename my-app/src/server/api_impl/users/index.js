const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method === 'GET') {
    const users = await User.find().sort({ name: 1 });
    return res.json(users);
  }
  return res.status(405).json({ message: 'Method not allowed' });
};
