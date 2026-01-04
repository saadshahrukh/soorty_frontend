const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return; // requireAuth already sent response
  const out = { user: { id: user._id, name: user.name, email: user.email, role: user.role } };
  res._jsonBody = out;
  return res.json(out);
};
