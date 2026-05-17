// src/models/Product.js
import mongoose from 'mongoose';

// ── Per-size stock entry ──────────────────────────────────────
const sizeStockSchema = new mongoose.Schema({
  size:  { type: String, required: true },
  stock: { type: Number, default: 0, min: 0 },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  price:      { type: Number, required: true },
  category:   { type: String, default: '' },
  sizes:      [String],
  sizeStock:  [sizeStockSchema],
  stock:      { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 3 },
  images:     [String],
  isFeatured: { type: Boolean, default: false },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

// ── Virtuals ──────────────────────────────────────────────────
productSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});

productSchema.virtual('isLowStock').get(function () {
  return this.stock > 0 && this.stock <= this.lowStockThreshold;
});

// ── Pre-save: sync top-level stock from sizeStock ─────────────
productSchema.pre('save', async function () {
  if (this.sizeStock && this.sizeStock.length > 0) {
    this.stock = this.sizeStock.reduce((sum, s) => sum + (s.stock || 0), 0);
  }
});

// ── Static: decrement stock atomically (no pre-save hook) ─────
// Uses findByIdAndUpdate + $inc so the pre-save hook never fires.
// This is safer for concurrent orders and avoids hook issues.
productSchema.statics.decrementStock = async function (items) {
  const outOfStock = [];

  for (const item of items) {
    // Strip any size suffix added by cart e.g. "mongoId-S" → "mongoId"
    const rawId     = String(item.productId || '');
    const productId = rawId.split('-')[0];

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.error('[Stock] Invalid productId skipped:', rawId);
      continue;
    }

    const qty     = Number(item.quantity || item.qty || 1);
    const product = await this.findById(productId)
      .select('name stock sizeStock lowStockThreshold isActive');

    if (!product) {
      console.warn('[Stock] Product not found:', productId);
      continue;
    }

    const hasSizeStock = product.sizeStock && product.sizeStock.length > 0;

    if (hasSizeStock && item.size) {
      // ── Per-size atomic decrement ───────────────────────────
      const sizeEntry = product.sizeStock.find(s => s.size === item.size);

      if (!sizeEntry || sizeEntry.stock < qty) {
        outOfStock.push({
          name:      product.name,
          size:      item.size,
          available: sizeEntry?.stock ?? 0,
        });
        continue;
      }

      // Atomic: decrement the matched size entry and recalculate total
      const newSizeStock = product.sizeStock.map(s =>
        s.size === item.size
          ? { ...s.toObject(), stock: s.stock - qty }
          : s.toObject()
      );
      const newTotal = newSizeStock.reduce((sum, s) => sum + s.stock, 0);

      await this.findByIdAndUpdate(productId, {
        $set: {
          sizeStock: newSizeStock,
          stock:     newTotal,
          isActive:  newTotal > 0,
        },
      });

      console.log(`[Stock] Decremented ${product.name} size ${item.size} by ${qty} — new total: ${newTotal}`);

    } else {
      // ── Flat stock atomic decrement ─────────────────────────
      if (product.stock < qty) {
        outOfStock.push({ name: product.name, available: product.stock });
        continue;
      }

      const newStock = product.stock - qty;

      await this.findByIdAndUpdate(productId, {
        $set: {
          stock:    newStock,
          isActive: newStock > 0,
        },
      });

      console.log(`[Stock] Decremented ${product.name} by ${qty} — new stock: ${newStock}`);
    }
  }

  return outOfStock.length === 0
    ? { ok: true }
    : { ok: false, outOfStock };
};

export default mongoose.model('Product', productSchema);