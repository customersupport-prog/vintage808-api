// src/controllers/orderController.js
import mongoose from 'mongoose';
import Order    from '../models/Order.js';
import {
  sendOrderConfirmation,
  sendAdminOrderNotification,
  sendOrderShipped,
  sendOrderDelivered,
  sendOrderCancelled,   // ← was missing
  sendReturnResolution,
  sendReturnReceived,
  sendAdminReturnAlert,
} from '../services/emailService.js';

const SHIPPING_FEE = 150;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function normaliseOrder(order) {
  const obj = order.toObject ? order.toObject() : { ...order };
  obj.id             = obj._id?.toString?.() || obj.id;
  obj.orderStatus    = obj.orderStatus || obj.status || 'pending';
  obj.paymentStatus  = obj.payment?.status || (obj.orderStatus === 'confirmed' ? 'paid' : 'pending');
  obj.orderNumber    = obj.orderNumber    || null;
  obj.trackingNumber = obj.tracking?.number  || null;
  obj.trackingUrl    = obj.tracking?.url     || null;
  obj.courier        = obj.tracking?.courier || null;
  return obj;
}

function nowStr() {
  return new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
}

function escapeRegex(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultNote(status, { courier, trackingNumber } = {}) {
  switch (status) {
    case 'confirmed':  return 'Payment received';
    case 'processing': return 'Order is being packed';
    case 'shipped':
      return courier && trackingNumber
        ? `Picked up by ${courier} — tracking: ${trackingNumber}`
        : courier ? `Picked up by ${courier}` : 'Order dispatched';
    case 'delivered':  return 'Delivered to customer';
    case 'cancelled':  return 'Order cancelled';
    default:           return '';
  }
}

// ─────────────────────────────────────────────
// POST /api/orders
// ─────────────────────────────────────────────
export const createOrder = async (req, res) => {
  const { items, total, subtotal, shippingFee, shippingAddress, customerName, customerEmail } = req.body;

  if (!items || !total) {
    return res.status(400).json({ success: false, message: 'Items and total are required' });
  }

  try {
    const userId         = req.user?.id || req.user?._id || null;
    const accountEmail   = (req.user?.email || '').toLowerCase().trim();
    const recipientEmail = (customerEmail   || '').toLowerCase().trim();

    const order = await Order.create({
      userId: userId && mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : null,
      customerName:   customerName || '',
      customerEmail:  accountEmail,
      // Store recipient separately if it differs (e.g. a gift)
      recipientEmail: recipientEmail && recipientEmail !== accountEmail ? recipientEmail : null,
      items,
      subtotal:    subtotal ?? total,
      shippingFee: shippingFee ?? SHIPPING_FEE,
      total,
      shippingAddress,
      orderStatus:   'pending',
      payment:       { method: 'manual', status: 'pending' },
      statusHistory: [{ status: 'pending', timestamp: nowStr(), note: 'Order placed' }],
    });

    if (accountEmail)        sendOrderConfirmation(order, accountEmail).catch(console.error);
    if (order.recipientEmail) sendOrderConfirmation(order, order.recipientEmail).catch(console.error);
    sendAdminOrderNotification(order).catch(console.error);

    return res.status(201).json({ success: true, message: 'Order placed', data: normaliseOrder(order) });
  } catch (error) {
    console.error('[Order] createOrder error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/orders
// ─────────────────────────────────────────────
export const getOrders = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const email  = (req.user?.email || '').toLowerCase().trim();

    if (!userId && !email) return res.json({ success: true, data: [] });

    const conditions = [];
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      conditions.push({ userId: new mongoose.Types.ObjectId(userId) });
    }
    if (email) {
      conditions.push({ customerEmail: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } });
    }
    if (!conditions.length) return res.json({ success: true, data: [] });

    const orders = await Order.find({ $or: conditions }).sort({ createdAt: -1 });
    return res.json({ success: true, data: orders.map(normaliseOrder) });
  } catch (error) {
    console.error('[Order] getOrders error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/orders/:id
// ─────────────────────────────────────────────
export const getOrderById = async (req, res) => {
  try {
    const isAdmin = ['admin', 'superadmin'].includes(req.user?.role);
    const order   = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (!isAdmin) {
      const userId      = req.user?._id || req.user?.id;
      const email       = (req.user?.email || '').toLowerCase().trim();
      const ownsById    = userId && order.userId?.toString() === userId.toString();
      const ownsByEmail = email && order.customerEmail?.toLowerCase() === email;
      if (!ownsById && !ownsByEmail) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    return res.json({ success: true, data: normaliseOrder(order) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/orders/:id/fulfil
// ─────────────────────────────────────────────
export const fulfilOrder = async (req, res) => {
  try {
    const { orderStatus, trackingNumber, courier, trackingUrl, estimatedDelivery, note, reason, refundExpected } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const previousStatus = order.orderStatus;

    if (orderStatus)       order.orderStatus         = orderStatus;
    if (trackingNumber)    order.tracking.number      = trackingNumber;
    if (courier)           order.tracking.courier     = courier;
    if (trackingUrl)       order.tracking.url         = trackingUrl;
    if (estimatedDelivery) order.estimatedDelivery    = new Date(estimatedDelivery);

    order.statusHistory = order.statusHistory || [];

    if (orderStatus && orderStatus !== previousStatus) {
      order.statusHistory.push({
        status:    orderStatus,
        timestamp: nowStr(),
        note:      note || defaultNote(orderStatus, { courier, trackingNumber }),
      });
    } else if ((trackingNumber || courier || trackingUrl) && !orderStatus) {
      order.statusHistory.push({
        status:    order.orderStatus,
        timestamp: nowStr(),
        note:      `Tracking updated: ${courier ? courier + ' — ' : ''}${trackingNumber || ''}`,
      });
    }

    await order.save();

    // ── Email triggers ──────────────────────────────────────────
    const email = order.customerEmail || order.email || order.user?.email;

    if (orderStatus && orderStatus !== previousStatus) {
      switch (orderStatus) {
        case 'confirmed':
          sendOrderConfirmation(order, email).catch(console.error);
          break;

        case 'shipped':
          sendOrderShipped(order, email).catch(console.error);
          break;

        case 'delivered':
          sendOrderDelivered(order, email).catch(console.error);
          break;

        case 'cancelled':
          sendOrderCancelled(order, email, {
            reason:         reason || '',
            refundExpected: refundExpected ?? false,
          }).catch(console.error);
          break;

        case 'return_approved':
        case 'return_rejected':
          sendReturnResolution(order, email).catch(console.error);
          break;
      }
    }

    // ── Tracking updated without status change — still notify ──
    if (!orderStatus && (trackingNumber || courier || trackingUrl)) {
      sendOrderShipped(order, email).catch(console.error);
    }

    return res.json({ success: true, data: normaliseOrder(order) });
  } catch (err) {
    console.error('[Order] fulfilOrder error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/orders/:id/return
// Customer submits a return request
// FIX: both email calls were missing in the original
// ─────────────────────────────────────────────
export const requestReturn = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'A reason is required' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Ownership check
    const userId      = req.user?._id || req.user?.id;
    const email       = (req.user?.email || '').toLowerCase().trim();
    const ownsById    = userId && order.userId?.toString() === userId.toString();
    const ownsByEmail = email && order.customerEmail?.toLowerCase() === email;
    if (!ownsById && !ownsByEmail) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
    }

    if (order.return?.status) {
      return res.status(409).json({
        success: false,
        message: `A return for this order is already ${order.return.status}`,
      });
    }

    order.return = { status: 'requested', reason: reason.trim(), requestedAt: new Date() };

    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status:    'return_requested',
      timestamp: nowStr(),
      note:      `Return requested: ${reason.trim()}`,
    });

    await order.save();

    // 1. Customer gets a confirmation that we received their request
    sendReturnReceived(order, order.customerEmail).catch(console.error);
    // 2. Admin gets an immediate alert
    sendAdminReturnAlert(order, order.customerEmail).catch(console.error);

    return res.status(201).json({ success: true, data: normaliseOrder(order) });
  } catch (err) {
    console.error('[Order] requestReturn error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/orders/:id/return
// Admin approves or rejects a return
// ─────────────────────────────────────────────
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
      timestamp: nowStr(),
      note:      note?.trim() || `Return ${status} by admin`,
    });

    await order.save();

    sendReturnResolution(order, order.customerEmail).catch(console.error);

    return res.json({ success: true, data: normaliseOrder(order) });
  } catch (err) {
    console.error('[Order] resolveReturn error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};