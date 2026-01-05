const { connectToDatabase } = require('../../lib/mongodb');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password || !name) return res.status(400).json({ message: 'Missing required fields' });
    let existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const created = await User.create({ name, email, password });
    const token = jwt.sign({ userId: created._id }, JWT_SECRET);
    const out = { token, user: { id: created._id, name: created.name, email: created.email, role: created.role } };
    res.status(201);
    res._jsonBody = out;
    return res.json(out);
  } catch (e) {
    console.error('Register error:', e);
    return res.status(500).json({ message: e.message });
  }
};
