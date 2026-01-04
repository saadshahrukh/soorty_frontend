const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { level, message, stack, raw } = req.body || {};
    console[level === 'error' ? 'error' : 'log']('Client log:', { level, message, stack, raw, user: user && { id: user._id, name: user.name } });
    const out = { ok: true };
    res._jsonBody = out;
    return res.json(out);
  } catch (e) {
    console.error('Failed to record log', e);
    return res.status(500).json({ ok: false });
  }
};
