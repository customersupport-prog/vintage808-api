// src/controllers/adminController.js
import User    from '../models/User.js';
import Order   from '../models/Order.js';
import Product from '../models/Product.js';
import bcrypt  from 'bcrypt';
import {
  sendOrderShipped,
  sendOrderDelivered,
  sendOrderCancelled,
  sendReturnResolution,
  sendPasswordChanged,
} from '../services/emailService.js';

// ─────────────────────────────────────────────
// In-memory settings
// Vercel/Railway have no writable filesystem so settings.json
// writes silently fail. Stored in memory for now.
// Swap for a Settings mongoose model when ready.
// ─────────────────────────────────────────────
let _settingsCache = {
  storeName:    'Vintage808',
  storeEmail:   '',
  storePhone:   '',
  storeAddress: '',
  currency:     'ZAR',
  shipping:     { minDays: 3, maxDays: 7, standardRate: 99, freeAbove: 1000 },
  notifications: { newOrder: true, lowStock: true, returnRequest: true, newUser: false },
};

function readSettings()       { return _settingsCache; }
function writeSettings(data)  { _settingsCache = { ..._settingsCache, ...data }; }

// ─────────────────────────────────────────────
// Seed super admin on boot
// ─────────────────────────────────────────────
export async function seedAdmin() {
  const superEmail    = process.env.SUPER_ADMIN_EMAIL;
  const superPassword = process.env.SUPER_ADMIN_PASSWORD;
  const superName     = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  if (superEmail && superPassword) {
    const exists = await User.findOne({ email: superEmail });
    if (!exists) {
      await User.create({ name: superName, email: superEmail, password: superPassword, role: 'superadmin' });
      console.log(`[Seed] Super admin created: ${superEmail}`);
    } else {
      console.log(`[Seed] Super admin already exists: ${superEmail}`);
    }
  } else {
    console.warn('[Seed] SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in .env');
  }
}

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────
export const getDashboard = async (req, res) => {
  try {
    const [totalOrders, totalUsers, totalProducts] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments(),
      Product.countDocuments(),
    ]);

    const revenueResult = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const dailyRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          count:   { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const statusBreakdown = await Order.aggregate([
      { $group: { _id: { $ifNull: ['$orderStatus', '$status'] }, count: { $sum: 1 } } },
    ]);

    const topProductsRaw = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id:     '$items.productId',
          name:    { $first: '$items.name' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          units:   { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const topCustomers = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id:        '$customerEmail',
          name:       { $first: '$customerName' },
          email:      { $first: '$customerEmail' },
          totalSpend: { $sum: '$total' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpend: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        totalUsers,
        totalProducts,
        dailyRevenue,
        statusBreakdown,
        topProducts:  topProductsRaw,
        topCustomers,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    const normalised = orders.map(o => {
      const obj = o.toObject();
      obj.orderStatus = obj.orderStatus || obj.status || 'pending';
      obj.status      = obj.orderStatus;
      return obj;
    });
    res.json({ success: true, data: normalised });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  const { id }                                        = req.params;
  const { status, tracking, estimatedDelivery, note } = req.body;
  const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
  }

  try {
    const updateFields = { status, orderStatus: status };
    if (tracking)          updateFields.tracking          = tracking;
    if (estimatedDelivery) updateFields.estimatedDelivery = new Date(estimatedDelivery);

    const order = await Order.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status,
      note:      note || '',
      timestamp: new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }),
    });
    await order.save();

    const obj = order.toObject();
    obj.orderStatus = obj.orderStatus || obj.status || 'pending';

    // ── Fire status emails (non-blocking) ──────────────────
    const email = obj.customerEmail;
    if (email) {
      if (status === 'shipped')   sendOrderShipped(obj, email).catch(e => console.error('[Email] shipped:', e.message));
      if (status === 'delivered') sendOrderDelivered(obj, email).catch(e => console.error('[Email] delivered:', e.message));
      if (status === 'cancelled') sendOrderCancelled(obj, email, { refundExpected: false }).catch(e => console.error('[Email] cancelled:', e.message));
    }

    res.json({ success: true, message: 'Order status updated', data: obj });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// Returns (admin)
// ─────────────────────────────────────────────

// GET /api/admin/returns
export const getReturns = async (req, res) => {
  try {
    const orders = await Order.find({ 'return.status': { $exists: true } })
      .sort({ 'return.requestedAt': -1 })
      .lean();

    const returns = orders.map(o => ({
      _id:           o._id,
      orderId:       o._id,
      orderRef:      o.orderNumber || ('#' + o._id.toString().slice(-6).toUpperCase()),
      customerName:  o.customerName  || '—',
      customerEmail: o.customerEmail || '',
      status:        o.return.status,
      reason:        o.return.reason,
      adminNote:     o.return.adminNote || null,
      requestedAt:   o.return.requestedAt,
      resolvedAt:    o.return.resolvedAt || null,
      items:         o.items || [],
      createdAt:     o.return.requestedAt,
    }));

    res.json({ success: true, data: returns });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PATCH /api/admin/orders/:id/return
export const resolveReturn = async (req, res) => {
  try {
    const { status, note } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'approved' or 'rejected'" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (!order.return?.status) {
      return res.status(400).json({ success: false, message: 'No return request on this order' });
    }
    if (order.return.status !== 'requested') {
      return res.status(409).json({ success: false, message: `Return is already ${order.return.status}` });
    }

    order.return.status     = status;
    order.return.resolvedAt = new Date();
    order.return.adminNote  = note?.trim() || null;

    if (status === 'approved') order.orderStatus = 'returned';

    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status:    `return_${status}`,
      timestamp: new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }),
      note:      note?.trim() || `Return ${status} by admin`,
    });

    await order.save();
    sendReturnResolution(order, order.customerEmail).catch(console.error);

    const obj = order.toObject();
    obj.orderStatus = obj.orderStatus || obj.status || 'pending';
    res.json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────
export const getAllProductsAdmin = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const addProduct = async (req, res) => {
  const { name, price, category, sizes, images, isFeatured, stock, variants, description, tags, status, comparePrice } = req.body;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ success: false, message: 'Name and price are required' });
  }

  try {
    let sizeStock  = [];
    let totalStock = Number(stock) || 0;
    let sizesList  = Array.isArray(sizes) ? sizes : [];

    if (Array.isArray(variants) && variants.length > 0) {
      sizeStock  = variants.map(v => ({ size: v.size || v.name || '', stock: Math.max(0, parseInt(v.stock ?? v.quantity ?? 0) || 0) }));
      totalStock = sizeStock.reduce((sum, s) => sum + s.stock, 0);
      sizesList  = sizeStock.map(s => s.size);
    }

    const product = await Product.create({
      name,
      price:        Number(price),
      category:     category    || '',
      description:  description || '',
      tags:         Array.isArray(tags) ? tags : [],
      comparePrice: Number(comparePrice) || null,
      sizes:        sizesList,
      sizeStock,
      images:       Array.isArray(images) ? images : [],
      isFeatured:   isFeatured === true || isFeatured === 'true',
      isActive:     status !== 'inactive',
      stock:        totalStock,
    });

    res.status(201).json({ success: true, message: 'Product added', data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { name, price, category, sizes, images, isFeatured, stock, variants, description, tags, status, comparePrice } = req.body;

    const update = {
      ...(name         !== undefined && { name }),
      ...(price        !== undefined && { price: Number(price) }),
      ...(category     !== undefined && { category }),
      ...(description  !== undefined && { description }),
      ...(tags         !== undefined && { tags: Array.isArray(tags) ? tags : [] }),
      ...(comparePrice !== undefined && { comparePrice: Number(comparePrice) || null }),
      ...(status       !== undefined && { isActive: status !== 'inactive' }),
      ...(images       !== undefined && { images: Array.isArray(images) ? images : [] }),
      ...(isFeatured   !== undefined && { isFeatured: isFeatured === true || isFeatured === 'true' }),
    };

    if (Array.isArray(variants) && variants.length > 0) {
      update.sizeStock = variants.map(v => ({ size: v.size || v.name || '', stock: Math.max(0, parseInt(v.stock ?? v.quantity ?? 0) || 0) }));
      update.stock     = update.sizeStock.reduce((sum, s) => sum + s.stock, 0);
      update.sizes     = update.sizeStock.map(s => s.size);
    } else if (stock !== undefined) {
      update.stock = Number(stock);
    }

    if (sizes !== undefined && !Array.isArray(variants)) {
      update.sizes = Array.isArray(sizes) ? sizes : [];
    }

    const product = await Product.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    res.json({ success: true, message: 'Product updated', data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted', data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const bulkDeleteProducts = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ success: false, message: 'ids array is required' });
  }
  try {
    const result = await Product.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `${result.deletedCount} product(s) deleted` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const adjustProductStock = async (req, res) => {
  const { size, type, quantity } = req.body;
  const { id }                   = req.params;

  if (!size) return res.status(400).json({ success: false, message: 'Size is required' });
  if (!['set', 'add', 'remove'].includes(type)) {
    return res.status(400).json({ success: false, message: 'type must be set, add, or remove' });
  }

  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const sizeStock = product.sizeStock || [];
    const idx       = sizeStock.findIndex(s => s.size === size);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Size "${size}" not found on this product` });
    }

    const current = sizeStock[idx].stock;
    let newQty;
    if (type === 'set')    newQty = Math.max(0, quantity);
    if (type === 'add')    newQty = current + quantity;
    if (type === 'remove') newQty = Math.max(0, current - quantity);

    sizeStock[idx].stock = newQty;
    const totalStock     = sizeStock.reduce((sum, s) => sum + s.stock, 0);

    await Product.findByIdAndUpdate(id, { $set: { sizeStock, stock: totalStock } });
    res.json({ success: true, message: `Stock updated — ${size} is now ${newQty}`, data: { size, stock: newQty, totalStock } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  const { role }      = req.body;
  const requestorRole = req.user.role;

  if (role === 'superadmin' && requestorRole !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Only Super Admin can assign Super Admin role' });
  }
  if (!['user', 'admin', 'superadmin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'superadmin' && requestorRole !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot modify a Super Admin account' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    res.json({ success: true, message: 'User role updated', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  const requestorRole = req.user.role;
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot delete a Super Admin account' });
    }
    if (target.role === 'admin' && requestorRole !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can delete admin accounts' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const toggleBanUser = async (req, res) => {
  const requestorRole = req.user.role;
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot ban a Super Admin' });
    }
    if (target.role === 'admin' && requestorRole !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can ban admins' });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: !target.isBanned },
      { new: true }
    ).select('-password');

    res.json({ success: true, message: updated.isBanned ? 'User banned' : 'User unbanned', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.id }).sort({ createdAt: -1 });
    const normalised = orders.map(o => {
      const obj = o.toObject();
      obj.orderStatus = obj.orderStatus || obj.status || 'pending';
      obj.status      = obj.orderStatus;
      return obj;
    });
    res.json({ success: true, data: normalised });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// Discounts
// In-memory for now — swap _discounts for a Discount
// mongoose model whenever you're ready.
// ─────────────────────────────────────────────
let _discounts = [];

export const getAllDiscounts = async (req, res) => {
  res.json({ success: true, data: _discounts });
};

export const createDiscount = async (req, res) => {
  const { code, type, value, minOrderValue, usageLimit, expiresAt, oncePerCustomer } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Code is required' });
  }
  if (type !== 'free_shipping' && !value) {
    return res.status(400).json({ success: false, message: 'Value is required' });
  }
  if (_discounts.find(d => d.code === code.toUpperCase())) {
    return res.status(409).json({ success: false, message: 'A discount with this code already exists' });
  }

  const discount = {
    _id:             Date.now().toString(),
    code:            code.toUpperCase().trim(),
    type:            type || 'percentage',
    value:           Number(value) || 0,
    minOrderValue:   Number(minOrderValue) || 0,
    usageLimit:      Number(usageLimit) || null,
    usedCount:       0,
    totalDiscounted: 0,
    expiresAt:       expiresAt ? new Date(expiresAt) : null,
    oncePerCustomer: !!oncePerCustomer,
    isActive:        true,
    createdAt:       new Date(),
  };

  _discounts.unshift(discount);
  res.status(201).json({ success: true, message: `Code ${discount.code} created`, data: discount });
};

export const updateDiscount = async (req, res) => {
  const idx = _discounts.findIndex(d => d._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Discount not found' });
  _discounts[idx] = { ..._discounts[idx], ...req.body };
  res.json({ success: true, message: 'Discount updated', data: _discounts[idx] });
};

export const deleteDiscount = async (req, res) => {
  const before = _discounts.length;
  _discounts   = _discounts.filter(d => d._id !== req.params.id);
  if (_discounts.length === before) {
    return res.status(404).json({ success: false, message: 'Discount not found' });
  }
  res.json({ success: true, message: 'Discount deleted' });
};

// POST /api/discounts/validate — used by the frontend cart at checkout
export const validateDiscount = async (req, res) => {
  const { code, orderTotal } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

  const discount = _discounts.find(d => d.code === code.toUpperCase() && d.isActive);
  if (!discount) {
    return res.status(404).json({ success: false, message: 'Invalid or inactive discount code' });
  }

  const now = new Date();
  if (discount.expiresAt && new Date(discount.expiresAt) < now) {
    return res.status(400).json({ success: false, message: 'This discount code has expired' });
  }
  if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
    return res.status(400).json({ success: false, message: 'This discount code has reached its usage limit' });
  }
  if (discount.minOrderValue && Number(orderTotal) < discount.minOrderValue) {
    return res.status(400).json({
      success: false,
      message: `Minimum order of R${discount.minOrderValue.toFixed(2)} required for this code`,
    });
  }

  let saving = 0;
  if (discount.type === 'percentage') saving = (Number(orderTotal) * discount.value) / 100;
  if (discount.type === 'fixed')      saving = discount.value;
  // free_shipping: saving stays 0 — handled separately at checkout

  res.json({
    success: true,
    data: {
      code:         discount.code,
      type:         discount.type,
      value:        discount.value,
      saving:       Math.min(saving, Number(orderTotal)),
      freeShipping: discount.type === 'free_shipping',
    },
  });
};

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────
export const getSettings = async (req, res) => {
  res.json({ success: true, data: readSettings() });
};

export const updateStoreSettings = async (req, res) => {
  try {
    writeSettings(req.body);
    res.json({ success: true, message: 'Settings saved', data: readSettings() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save settings', error: error.message });
  }
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both fields are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  try {
    const user = await User.findById(req.user.id || req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    sendPasswordChanged(user).catch(console.error);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};