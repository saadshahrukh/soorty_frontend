const { connectToDatabase } = require('../../../lib/mongodb');
const User = require('../../../../api/models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing required fields' });

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    user = new User({ name, email, password, role });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    const out = {
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    };
    res._jsonBody = out;
    return res.json(out);
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
