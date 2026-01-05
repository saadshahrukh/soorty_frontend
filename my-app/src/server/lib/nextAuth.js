const jwt = require('jsonwebtoken');
const User = require('../../server/models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

async function requireAuth(req, res) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      res.status(401).json({ message: 'No token, authorization denied' });
      return null;
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      res.status(401).json({ message: 'Token is not valid' });
      return null;
    }
    req.user = user;
    return user;
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
    return null;
  }
}

module.exports = { requireAuth };
