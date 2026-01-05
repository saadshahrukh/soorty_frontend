const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  // Minimal pass-through (original implementation logs and returns)
  return res.json({ message: 'logs recorded (backup handler)' });
};
