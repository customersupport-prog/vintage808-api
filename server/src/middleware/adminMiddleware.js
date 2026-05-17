// src/middleware/adminMiddleware.js
import jwt from 'jsonwebtoken';

export const adminOnly = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');

    if (!['admin', 'superadmin'].includes(decoded.role)) {
      return res.status(403).json({ success: false, message: 'Admin access only' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};