const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const User = require('../../models/User');

module.exports = async (req, res) => {
  if (req.method !== 'PUT') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { email, name } = req.body;
  const updated = await User.findByIdAndUpdate(user._id, { email, name }, { new: true });
  res.json(updated);
};
