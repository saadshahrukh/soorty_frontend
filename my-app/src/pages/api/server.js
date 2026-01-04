// Deprecated: migrated to native Next.js API routes
// This file is no longer used. All endpoints are under /api/*
module.exports = (req, res) => {
  res.status(410).json({ message: 'This endpoint is deprecated. Use native Next.js API routes instead.' });
};
