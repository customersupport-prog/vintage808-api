import jwt from 'jsonwebtoken';
import express from 'express';
import {
  createOrder,
  getOrders,
  getOrderById,
  fulfilOrder,
  requestReturn,   // ← new
  resolveReturn,   // ← new
} from '../controllers/orderController.js';
const router = express.Router();
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'secretkey');
    // Normalise so both req.user.id and req.user._id always work
    req.user = { ...decoded, _id: decoded.id || decoded._id };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
const requireAdmin = (req, res, next) => {
  if (!['admin', 'superadmin'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Admins only' });
  }
  next();
};

// Existing routes
router.post('/',            requireAuth,              createOrder);
router.get('/',             requireAuth,              getOrders);
router.get('/:id',          requireAuth,              getOrderById);
router.patch('/:id/fulfil', requireAuth, requireAdmin, fulfilOrder);

// Return routes
router.post ('/:id/return', requireAuth,              requestReturn);  // customer
router.patch('/:id/return', requireAuth, requireAdmin, resolveReturn); // admin

export default router;