// src/routes/productRoutes.js
import express from 'express';
import {
  getAllProducts,
  getProductById,
  getProductsByCategory,
} from '../controllers/productController.js';

const router = express.Router();

// GET /api/products
router.get('/', getAllProducts);

// GET /api/products/category/:category  ← must be before /:id
router.get('/category/:category', getProductsByCategory);

// GET /api/products/:id
router.get('/:id', getProductById);

export default router;