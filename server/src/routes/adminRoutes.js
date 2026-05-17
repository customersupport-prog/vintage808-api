// src/routes/adminRoutes.js
import express from 'express';
import {
  getDashboard,
  getAllOrders,
  adjustProductStock,
  updateOrderStatus,
  getAllProductsAdmin,
  addProduct,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  getAllUsers,
  updateUserRole,
  deleteUser,
  toggleBanUser,
  getUserOrders,
  getSettings,
  updateStoreSettings,
  changePassword,getReturns,
} from '../controllers/adminController.js';

import { protect }     from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(protect, requireAdmin);

// ── Dashboard ──────────────────────────────────────────────
router.get('/dashboard', getDashboard);

// ── Orders ─────────────────────────────────────────────────
router.get('/orders',            getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.put('/products/:id/stock', adjustProductStock);
// ── Products ───────────────────────────────────────────────
router.get('/products',              getAllProductsAdmin);
router.post('/products/bulk-delete', bulkDeleteProducts); // ← MUST be before /:id
router.post('/products',             addProduct);
router.put('/products/:id',          updateProduct);
router.delete('/products/:id',       deleteProduct);
router.get('/returns', adminOnly, getReturns);

// ── Users ──────────────────────────────────────────────────
router.get('/users',            getAllUsers);
router.put('/users/:id/role',   updateUserRole);
router.put('/users/:id/ban',    toggleBanUser);
router.delete('/users/:id',     deleteUser);
router.get('/users/:id/orders', getUserOrders);

// ── Settings ───────────────────────────────────────────────
router.get('/settings',          getSettings);
router.put('/settings/store',    updateStoreSettings);
router.put('/settings/password', changePassword);

export default router;