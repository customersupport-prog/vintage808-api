// src/controllers/productController.js
import Product from '../models/Product.js';

// GET /api/products
export const getAllProducts = async (req, res) => {
  try {
    const { category, featured } = req.query;
    const filter = {};

    if (category)            filter.category   = category;
    if (featured === 'true') filter.isFeatured = true;

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/products/:id
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/products/category/:category
export const getProductsByCategory = async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.category });
    if (!products.length) {
      return res.status(404).json({ success: false, message: 'No products found in this category' });
    }
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};