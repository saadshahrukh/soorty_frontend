const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Old and new passwords required' });

  const userDoc = await User.findById(user._id);
  if (!await bcrypt.compare(oldPassword, userDoc.password)) return res.status(401).json({ message: 'Invalid password' });

  userDoc.password = await bcrypt.hash(newPassword, 10);
  await userDoc.save();
  res.json({ message: 'Password changed' });
};
