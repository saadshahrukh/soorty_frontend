const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');

// Get all users (admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get audit logs
router.get('/audit-logs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const { limit = 100 } = req.query;
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'name email');
    
    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete audit logs by filter (Admin only)
router.delete('/audit-logs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { startDate, endDate, action, entityType, userId } = req.body || {};

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (action && ['CREATE','UPDATE','DELETE','VIEW'].includes(action)) query.action = action;
    if (entityType) query.entityType = entityType;
    if (userId) query.userId = userId;

    const result = await AuditLog.deleteMany(query);
    return res.json({ deletedCount: result.deletedCount || 0 });
  } catch (error) {
    console.error('Delete audit logs error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

