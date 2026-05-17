// server/src/routes/uploadRoutes.js
import express from 'express';
import { upload, uploadImage, deleteImage } from '../controllers/uploadController.js';
import { protect }      from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

// All upload routes require valid JWT + admin role
router.use(protect, requireAdmin);

// POST /api/upload — upload single image to Cloudinary
router.post('/', upload.single('image'), uploadImage);

// DELETE /api/upload — delete image from Cloudinary
router.delete('/', deleteImage);

export default router;