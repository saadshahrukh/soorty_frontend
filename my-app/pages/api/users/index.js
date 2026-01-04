const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const User = require('../../../api/models/User');
const AuditLog = require('../../../api/models/AuditLog');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      if (user.role !== 'Admin') return res.status(403).json({ message: 'Access denied' });
      const users = await User.find().select('-password');
      res._jsonBody = users;
      return res.json(users);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Users handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
