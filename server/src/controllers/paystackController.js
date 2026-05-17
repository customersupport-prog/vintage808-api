// src/controllers/paystackController.js
import fetch  from 'node-fetch';
import Order  from '../models/Order.js';
import { sendOrderConfirmation, sendAdminOrderNotification } from '../services/emailService.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const CLIENT_URL      = 'https://vintage808.co.za';

// ─────────────────────────────────────────────
// POST /api/paystack/initialize
// Body: { email, amount, items, address, customerName, userId, subtotal, shippingFee }
// ─────────────────────────────────────────────
export const initializePayment = async (req, res) => {
  try {
    const {
      email,
      customerName,
      userId,
      items,
      address,
      subtotal,
      shippingFee = 0,
    } = req.body;

    if (!email || !items?.length) {
      return res.status(400).json({ success: false, message: 'Email and items are required' });
    }

    const total      = Number(subtotal) + Number(shippingFee);
    const amountKobo = Math.round(total * 100); // Paystack uses kobo (cents)

    // Create a pending order in DB first so we have an ID to attach to the payment
    const order = await Order.create({
      userId:        userId || null,
      customerName,
      customerEmail: email,
      items,
      subtotal:      Number(subtotal),
      shippingFee:   Number(shippingFee),
      total,
      shippingAddress: address,
      orderStatus:   'pending',
      payment: {
        method: 'paystack',
        status: 'initiated',
      },
      statusHistory: [{
        status:    'pending',
        timestamp: new Date().toLocaleString('en-ZA'),
        note:      'Order created, awaiting payment',
      }],
    });

    // Call Paystack initialize endpoint
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount:       amountKobo,
        currency:     'ZAR',
        reference:    order._id.toString(), // use order ID as reference
        callback_url: `${CLIENT_URL}/order-success.html`,
        metadata: {
          orderId:      order._id.toString(),
          customerName,
          cancel_action: `${CLIENT_URL}/checkout.html?status=cancelled&restore=1`,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      // Clean up the pending order if Paystack rejected
      await Order.findByIdAndDelete(order._id);
      return res.status(400).json({ success: false, message: paystackData.message || 'Paystack initialization failed' });
    }

    res.json({
      success:           true,
      authorization_url: paystackData.data.authorization_url,
      reference:         paystackData.data.reference,
      orderId:           order._id.toString(),
    });

  } catch (err) {
    console.error('[Paystack] Initialize error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/paystack/verify
// Body: { reference }
// Called by frontend after Paystack redirects back
// ─────────────────────────────────────────────
export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference is required' });
    }

    // Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: paystackData.data?.gateway_response || 'Payment verification failed',
      });
    }

    const tx      = paystackData.data;
    const orderId = tx.metadata?.orderId || reference;

    // Update order in DB
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        orderStatus: 'confirmed',
        'payment.status':        'paid',
        'payment.transactionId': tx.reference,
        'payment.paidAt':        new Date(),
        $push: {
          statusHistory: {
            status:    'confirmed',
            timestamp: new Date().toLocaleString('en-ZA'),
            note:      `Payment confirmed via Paystack. Ref: ${tx.reference}`,
          },
        },
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Send confirmation emails (non-blocking — email failure won't break the response)
    await Promise.allSettled([
      sendOrderConfirmation(order, order.customerEmail),
      sendAdminOrderNotification(order),
    ]);

    res.json({ success: true, order });

  } catch (err) {
    console.error('[Paystack] Verify error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/paystack/webhook
// Paystack calls this server-side on payment events
// Add your webhook secret to .env as PAYSTACK_WEBHOOK_SECRET
// ─────────────────────────────────────────────
export const webhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;

    // Validate signature
    if (secret) {
      const crypto    = await import('crypto');
      const hash      = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
      const signature = req.headers['x-paystack-signature'];
      if (hash !== signature) {
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      const orderId = data.metadata?.orderId || data.reference;

      const order = await Order.findByIdAndUpdate(
        orderId,
        {
          orderStatus:             'confirmed',
          'payment.status':        'paid',
          'payment.transactionId': data.reference,
          'payment.paidAt':        new Date(),
          $push: {
            statusHistory: {
              status:    'confirmed',
              timestamp: new Date().toLocaleString('en-ZA'),
              note:      `Webhook: Payment confirmed. Ref: ${data.reference}`,
            },
          },
        },
        { new: true }
      );

      // Send confirmation emails if order was found
      if (order) {
        await Promise.allSettled([
          sendOrderConfirmation(order, order.customerEmail),
          sendAdminOrderNotification(order),
        ]);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Paystack] Webhook error:', err.message);
    res.sendStatus(500);
  }
};