// src/routes/authRoutes.js
import express  from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  register,
  login,
  getMe,
  googleAuth,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getProfile,
  updateProfile,
  getPreferences,
  updatePreferences,
  getAddresses,
  addAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  createReturn,
  getReturns,
} from '../controllers/authController.js';

const router = express.Router();

// ── Public — no token required ────────────────────────────────
router.post('/register',        register);
router.post('/login',           login);
router.post('/google',          googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp',      verifyOtp);
router.post('/reset-password',  resetPassword);

// ── Protected — token required (per-route, not global) ────────
// Previously router.use(protect) was blocking login itself
router.get('/me',      protect, getMe);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

router.get('/preferences', protect, getPreferences);
router.put('/preferences', protect, updatePreferences);

router.get('/addresses',             protect, getAddresses);
router.post('/addresses',            protect, addAddress);
router.put('/addresses/:id',         protect, updateAddress);
router.put('/addresses/:id/default', protect, setDefaultAddress);
router.delete('/addresses/:id',      protect, deleteAddress);

router.get('/returns',  protect, getReturns);
router.post('/returns', protect, createReturn);

export default router;