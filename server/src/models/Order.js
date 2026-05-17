// src/models/Order.js
import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId: String,
  name:      String,
  price:     Number,
  size:      String,
  quantity:  { type: Number, default: 1 },
  image:     String,
});

const paymentSchema = new mongoose.Schema({
method: {
  type: String,
  enum: ['payfast', 'paystack', 'cash', 'manual'],
  default: 'paystack',
 },
  status: {
    type:    String,
    enum:    ['initiated', 'pending', 'paid', 'failed', 'cancelled'],  // ← added 'initiated'
    default: 'pending',
  },
  transactionId: String,
  paidAt:        Date,
});

const orderSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName:  String,
  customerEmail: String,
  recipientEmail: String,
  items:         [orderItemSchema],
  subtotal:      { type: Number, required: true },
  shippingFee:   { type: Number, default: 150 },
  total:         { type: Number, required: true },
  payment:       paymentSchema,

  orderStatus: {
    type:    String,
    enum:    ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending',
  },

  orderNumber: {
    type:   String,
    unique: true,
    sparse: true,
  },

  estimatedDelivery: Date,

  statusHistory: [{
    status:    String,
    timestamp: String,
    note:      String,
  }],

  tracking: {
    number:  { type: String, default: '' },
    courier: { type: String, default: '' },
    url:     { type: String, default: '' },
  },

  shippingAddress: {
    street:   String,
    city:     String,
    province: String,
    postal:   String,
    phone:    String,
  },

  return: {
    status:      { type: String, enum: ['requested', 'approved', 'rejected'] },
    reason:      String,
    requestedAt: Date,
    resolvedAt:  Date,
    adminNote:   String,
  },

}, { timestamps: true });

// ── Pre-save: generate ORD-YYYY-NNNNN order number ───────────
orderSchema.pre('save', async function () {
  if (this.orderNumber) return;

  const year      = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);

  for (let attempt = 0; attempt < 5; attempt++) {
    const count     = await mongoose.model('Order').countDocuments({ createdAt: { $gte: yearStart } });
    const candidate = `ORD-${year}-${String(count + 1).padStart(5, '0')}`;
    const exists    = await mongoose.model('Order').findOne({ orderNumber: candidate }).lean();

    if (!exists) {
      this.orderNumber = candidate;
      return;
    }
  }

  this.orderNumber = `ORD-${year}-${Date.now().toString().slice(-6)}`;
});

export default mongoose.model('Order', orderSchema);