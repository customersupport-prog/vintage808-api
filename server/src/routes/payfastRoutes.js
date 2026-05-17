// src/routes/payfastRoutes.js
import express     from 'express';
import crypto      from 'crypto';
import axios       from 'axios';
import querystring from 'querystring';
import Order       from '../models/Order.js';
import Product     from '../models/Product.js';
import {
  sendOrderConfirmation,
  sendAdminOrderNotification,
  sendLowStockAlert,
} from '../services/emailService.js';

const router = express.Router();

// ─────────────────────────────────────────────
// Config — read at request time, not import time
// ─────────────────────────────────────────────
function getConfig() {
  return {
    merchant_id:  process.env.PF_MERCHANT_ID,
    merchant_key: process.env.PF_MERCHANT_KEY,
    passphrase:   process.env.PF_PASSPHRASE || '',
    host:         'https://www.payfast.co.za/eng/process',   // ← back to host
    validate_url: 'https://www.payfast.co.za/eng/query/validate',
    SITE: process.env.FRONTEND_URL,
    API:  process.env.API_URL,
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function sanitizeCellNumber(raw) {
  if (!raw) return null;
  let num = String(raw).trim().replace(/[\s\-().]/g, '');
  if (num.startsWith('+27'))                          num = '0' + num.slice(3);
  else if (num.startsWith('27') && num.length === 11) num = '0' + num.slice(2);
  return /^0\d{9}$/.test(num) ? num : null;
}

// Outgoing signature — skip empty/null values
function generateSignature(data, passphrase = '') {
  const str = Object.entries(data)
    .filter(([key, value]) =>
      key !== 'signature' &&
      value !== undefined &&
      value !== null &&
      value !== ''
    )
    .map(([k, v]) =>
      `${k}=${encodeURIComponent(String(v).trim()).replace(/%20/g, '+')}`
    )
    .join('&');

  const finalStr = (passphrase && passphrase.trim())
    ? `${str}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`
    : str;

  console.log('[PayFast] Outgoing sig string:', finalStr);
  return crypto.createHash('md5').update(finalStr).digest('hex');
}

// ITN signature — keep ALL fields PayFast sent, even empty ones
function generateITNSignature(data, passphrase = '') {
  const str = Object.entries(data)
    .filter(([key]) => key !== 'signature')
    .map(([k, v]) =>
      `${k}=${encodeURIComponent(String(v ?? '').trim()).replace(/%20/g, '+')}`
    )
    .join('&');

  const finalStr = (passphrase && passphrase.trim())
    ? `${str}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`
    : str;

  console.log('[PayFast] ITN sig string:', finalStr);
  return crypto.createHash('md5').update(finalStr).digest('hex');
}

async function validateITN(pfData, validate_url) {
  const data     = querystring.stringify(pfData);
  const response = await axios.post(validate_url, data, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data === 'VALID';
}

// ─────────────────────────────────────────────
// POST /api/payfast/pay
// ─────────────────────────────────────────────
router.post('/pay', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { merchant_id, merchant_key, passphrase, host, SITE, API } = getConfig();

    // Guard — fail fast if env vars missing
    if (!merchant_id || !merchant_key || !SITE || !API) {
      console.error('[PayFast] Missing env vars:', {
        PF_MERCHANT_ID:  !!merchant_id,
        PF_MERCHANT_KEY: !!merchant_key,
        FRONTEND_URL:    SITE,
        API_URL:         API,
      });
      return res.status(500).send('Payment configuration error.');
    }

    const {
      first_name, last_name, email, cell_number,
      amount, item_name, items, address, userId,
      accountEmail, recipientEmail,
    } = req.body;

    if (!first_name || !email || !amount) {
      return res.status(400).send('Missing required fields.');
    }

    const parsedItems   = items   ? JSON.parse(items)   : [];
    const parsedAddress = address ? JSON.parse(address) : {};
    const shippingFee   = Number(req.body.shippingFee ?? 0);
    const total         = Number(amount);
    const subtotalAmt   = Number(req.body.subtotal ?? total);
    const cleanCell     = sanitizeCellNumber(cell_number);
    const ownerEmail    = accountEmail || email;

    // ── Pre-payment stock warning (non-blocking) ──
    for (const item of parsedItems) {
      if (!item.productId) continue;
      const productId = item.productId.toString().split('-')[0];
      const product   = await Product.findById(productId).select('name stock sizeStock');
      if (!product) continue;

      const qty = item.quantity || item.qty || 1;
      let available = product.stock;
      if (product.sizeStock?.length > 0 && item.size) {
        const se = product.sizeStock.find(s => s.size === item.size);
        if (se) available = se.stock;
      }
      if (available < qty) {
        console.warn(`[Stock] Pre-pay warning: ${product.name} (${item.size}) — requested ${qty}, available ${available}`);
      }
    }

    // ── Create pending order ──
    const pendingOrder = await Order.create({
      ...(userId && { userId }),
      customerName:   `${first_name} ${last_name || ''}`.trim(),
      customerEmail:  ownerEmail,
      recipientEmail: recipientEmail && recipientEmail !== ownerEmail ? recipientEmail : null,
      items:          parsedItems,
      subtotal:       subtotalAmt,
      shippingFee,
      total,
      shippingAddress: {
        street:   parsedAddress.street   || '',
        city:     parsedAddress.city     || '',
        province: parsedAddress.province || '',
        postal:   parsedAddress.postal   || '',
        phone:    cleanCell || parsedAddress.phone || cell_number || '',
      },
      orderStatus: 'pending',
      payment: { method: 'payfast', status: 'initiated' },
    });

    const orderId = pendingOrder._id.toString();
    console.log('[PayFast] Pending order created (not confirmed):', orderId);
    if (!cleanCell) console.warn('[PayFast] cell_number omitted (invalid):', cell_number);

    // ── Build PayFast payload ──
    const pfData = {
      merchant_id,
      merchant_key,
      return_url:    `${SITE}/payment-processing.html?order=${orderId}`,
      cancel_url:    `${API}/api/payfast/cancel?order=${orderId}`,
      notify_url:    `${API}/api/payfast/notify`,
      name_first:    first_name,
      name_last:     last_name || '-',
      email_address: email,
      ...(cleanCell && { cell_number: cleanCell }),
      m_payment_id:  orderId,
      amount:        total.toFixed(2),
      item_name:     item_name || 'Vintage808 Order',
    };

    pfData.signature = generateSignature(pfData, passphrase);

    const inputs = Object.entries(pfData)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
      .join('\n');

    return res.send(`<!DOCTYPE html>
<html>
  <body>
    <p style="text-align:center;margin-top:50px;font-family:sans-serif;color:#111;">
      Redirecting to secure payment…
    </p>
    <form id="pf" method="POST" action="${host}">
      ${inputs}
    </form>
    <script>document.getElementById('pf').submit();</script>
  </body>
</html>`);

  } catch (err) {
    console.error('[PayFast] /pay error:', err);
    return res.status(500).send('Payment initiation failed.');
  }
});

// ─────────────────────────────────────────────
// GET /api/payfast/cancel
// ─────────────────────────────────────────────
router.get('/cancel', async (req, res) => {
  const { SITE } = getConfig();
  try {
    const { order: orderId } = req.query;

    if (orderId) {
      const order = await Order.findById(orderId);
      if (order && order.payment?.status === 'initiated') {
        order.orderStatus    = 'cancelled';
        order.payment.status = 'cancelled';
        order.statusHistory  = order.statusHistory || [];
        order.statusHistory.push({
          status:    'cancelled',
          timestamp: new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }),
          note:      'Cancelled by customer on PayFast payment page',
        });
        await order.save();
        console.log('[PayFast] Order cancelled by customer:', orderId);
      }
    }

    return res.redirect(`${SITE}/checkout.html?status=cancelled`);

  } catch (err) {
    console.error('[PayFast] /cancel error:', err);
    return res.redirect(`${SITE}/checkout.html?status=cancelled`);
  }
});

// ─────────────────────────────────────────────
// POST /api/payfast/notify  (ITN handler)
// ─────────────────────────────────────────────
router.post('/notify', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { passphrase, validate_url } = getConfig();
    const pfData = req.body;
    console.log('[PayFast] ITN received:', pfData);

    // 1. Verify signature
    const receivedSignature = pfData.signature;
    const expectedSignature = generateITNSignature(pfData, passphrase);
    console.log('[PayFast] Sig received:', receivedSignature);
    console.log('[PayFast] Sig expected:', expectedSignature);
    console.log('[PayFast] Sig match:',    receivedSignature === expectedSignature);

    if (receivedSignature !== expectedSignature) {
      console.warn('[PayFast] Signature mismatch');
      return res.status(400).send('Invalid signature');
    }

    // 2. Validate with PayFast servers
    const isValid = await validateITN(pfData, validate_url);
    if (!isValid) {
      console.warn('[PayFast] ITN validation failed');
      return res.status(400).send('Invalid ITN');
    }

    // 3. Find order
    const order = await Order.findById(pfData.m_payment_id);
    if (!order) {
      console.warn('[PayFast] Order not found:', pfData.m_payment_id);
      return res.status(404).send('Order not found');
    }

    // 4. Amount check
    const receivedAmount = Number(pfData.amount_gross).toFixed(2);
    const expectedAmount = Number(order.total).toFixed(2);
    if (receivedAmount !== expectedAmount) {
      console.warn('[PayFast] Amount mismatch — received:', receivedAmount, 'expected:', expectedAmount);
      return res.status(400).send('Amount mismatch');
    }

    // 5. Handle payment status
    if (pfData.payment_status === 'COMPLETE') {

      if (order.payment?.status === 'paid') {
        console.log('[PayFast] Duplicate ITN — skipping:', order._id);
        return res.status(200).send('OK');
      }

      const stockResult = await Product.decrementStock(order.items || []);
      if (!stockResult.ok) {
        console.warn('[Stock] Oversell detected:', stockResult.outOfStock);
        sendLowStockAlert({
          type:    'oversell',
          orderId: order._id.toString(),
          items:   stockResult.outOfStock,
        }).catch(e => console.error('[Email] Oversell alert failed:', e.message));
      }

      checkAndAlertLowStock(order.items).catch(e =>
        console.error('[Stock] Low stock check error:', e.message)
      );

      order.orderStatus           = 'confirmed';
      order.payment.status        = 'paid';
      order.payment.paidAt        = new Date();
      order.payment.transactionId = pfData.pf_payment_id || '';
      order.statusHistory         = order.statusHistory || [];
      order.statusHistory.push({
        status:    'confirmed',
        timestamp: new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }),
        note:      'Payment confirmed by PayFast',
      });
      await order.save();
      console.log('[PayFast] Order confirmed:', order._id);

      sendOrderConfirmation(order, order.customerEmail).catch(e =>
        console.error('[Email] Confirmation failed:', e.message)
      );
      if (order.recipientEmail) {
        sendOrderConfirmation(order, order.recipientEmail).catch(e =>
          console.error('[Email] Recipient confirmation failed:', e.message)
        );
      }
      sendAdminOrderNotification(order).catch(e =>
        console.error('[Email] Admin notification failed:', e.message)
      );

    } else if (pfData.payment_status === 'FAILED') {
      order.payment.status = 'failed';
      order.orderStatus    = 'cancelled';
      order.statusHistory  = order.statusHistory || [];
      order.statusHistory.push({
        status:    'cancelled',
        timestamp: new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }),
        note:      'Payment failed on PayFast',
      });
      await order.save();
      console.log('[PayFast] Payment failed:', order._id);

    } else if (pfData.payment_status === 'CANCELLED') {
      if (order.payment?.status !== 'paid') {
        order.payment.status = 'cancelled';
        order.orderStatus    = 'cancelled';
        order.statusHistory  = order.statusHistory || [];
        order.statusHistory.push({
          status:    'cancelled',
          timestamp: new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }),
          note:      'Payment cancelled — PayFast ITN',
        });
        await order.save();
        console.log('[PayFast] Payment cancelled (ITN):', order._id);
      }
    }

    return res.status(200).send('OK');

  } catch (err) {
    console.error('[PayFast] ITN error:', err);
    return res.status(500).send('Error');
  }
});

// ─────────────────────────────────────────────
// GET /api/payfast/status/:id
// ─────────────────────────────────────────────
router.get('/status/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('orderStatus payment total customerName createdAt');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    console.error('[PayFast] Status check error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// Helper: alert admin when products go low
// ─────────────────────────────────────────────
async function checkAndAlertLowStock(items = []) {
  const checked = new Set();
  for (const item of items) {
    if (!item.productId || checked.has(item.productId.toString())) continue;
    checked.add(item.productId.toString());

    const product = await Product.findById(item.productId)
      .select('name stock lowStockThreshold');
    if (!product) continue;

    if (product.stock > 0 && product.stock <= product.lowStockThreshold) {
      console.log(`[Stock] Low stock: ${product.name} — ${product.stock} remaining`);
      sendLowStockAlert({
        type:    'low',
        product: { name: product.name, stock: product.stock },
      }).catch(e => console.error('[Email] Low stock alert failed:', e.message));
    }
  }
}

export default router;