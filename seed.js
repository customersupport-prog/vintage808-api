// seed.js — run once with: node seed.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
console.log('[Seed] Connected to MongoDB');

// ── Product model (inline so we don't need imports) ───────────
const productSchema = new mongoose.Schema({
  name:       String,
  price:      Number,
  category:   String,
  description:String,
  sizes:      [String],
  images:     [String],
  colors:     [String],
  stock:      mongoose.Schema.Types.Mixed,
  isFeatured: Boolean,
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// ── Products data ─────────────────────────────────────────────
const products = [
  {
    name: "Vintage Black Tee",
    category: "tshirts",
    price: 299,
    description: "Classic vintage black t-shirt made from premium cotton.",
    images: ["/images/tshirts/vintage-black.jpg"],
    sizes: ["S", "M", "L", "XL"],
    stock: { S: 10, M: 15, L: 12, XL: 8 },
    colors: ["black"],
    isFeatured: true,
  },
  {
    name: "Classic White Tee",
    category: "tshirts",
    price: 249,
    description: "Minimal white tee with a clean, timeless fit.",
    images: ["/images/tshirts/classic-white.jpg"],
    sizes: ["S", "M", "L", "XL"],
    stock: { S: 12, M: 20, L: 15, XL: 10 },
    colors: ["white"],
    isFeatured: false,
  },
  {
    name: "Oversized Grey Tee",
    category: "tshirts",
    price: 329,
    description: "Oversized t-shirt with a relaxed streetwear fit.",
    images: ["/images/tshirts/oversized-grey.jpg"],
    sizes: ["M", "L", "XL"],
    stock: { M: 14, L: 18, XL: 10 },
    colors: ["grey"],
    isFeatured: true,
  },
  {
    name: "Retro Graphic Tee",
    category: "tshirts",
    price: 349,
    description: "Retro-inspired graphic tee with bold branding.",
    images: ["/images/tshirts/retro-graphic.jpg"],
    sizes: ["S", "M", "L"],
    stock: { S: 8, M: 10, L: 6 },
    colors: ["black", "cream"],
    isFeatured: false,
  },
  {
    name: "Washed Brown Tee",
    category: "tshirts",
    price: 319,
    description: "Washed brown finish for a worn-in vintage look.",
    images: ["/images/tshirts/washed-brown.jpg"],
    sizes: ["S", "M", "L", "XL"],
    stock: { S: 6, M: 9, L: 7, XL: 5 },
    colors: ["brown"],
    isFeatured: false,
  },
  {
    name: "Vintage Black Shorts",
    category: "shorts",
    price: 399,
    description: "Relaxed vintage shorts designed for everyday comfort.",
    images: ["/images/shorts/vintage-black.jpg"],
    sizes: ["S", "M", "L"],
    stock: { S: 10, M: 14, L: 9 },
    colors: ["black"],
    isFeatured: true,
  },
  {
    name: "Classic Grey Shorts",
    category: "shorts",
    price: 379,
    description: "Classic grey shorts with a modern relaxed fit.",
    images: ["/images/shorts/classic-grey.jpg"],
    sizes: ["S", "M", "L", "XL"],
    stock: { S: 11, M: 13, L: 12, XL: 7 },
    colors: ["grey"],
    isFeatured: false,
  },
  {
    name: "Cargo Street Shorts",
    category: "shorts",
    price: 499,
    description: "Street-style cargo shorts with functional pockets.",
    images: ["/images/shorts/cargo-street.jpg"],
    sizes: ["M", "L", "XL"],
    stock: { M: 10, L: 8, XL: 6 },
    colors: ["olive", "black"],
    isFeatured: true,
  },
  {
    name: "Relaxed Fit Shorts",
    category: "shorts",
    price: 389,
    description: "Lightweight relaxed-fit shorts for everyday wear.",
    images: ["/images/shorts/relaxed-fit.jpg"],
    sizes: ["S", "M", "L"],
    stock: { S: 9, M: 12, L: 10 },
    colors: ["beige"],
    isFeatured: false,
  },
  {
    name: "Premium Cotton Shorts",
    category: "shorts",
    price: 529,
    description: "Premium cotton shorts with a tailored street look.",
    images: ["/images/shorts/premium-cotton.jpg"],
    sizes: ["M", "L", "XL"],
    stock: { M: 7, L: 6, XL: 4 },
    colors: ["black", "cream"],
    isFeatured: true,
  },
];

// ── Run seed ──────────────────────────────────────────────────
const existing = await Product.countDocuments();

if (existing > 0) {
  console.log(`[Seed] ${existing} products already in DB — skipping.`);
  console.log('[Seed] To re-seed, delete products from MongoDB Atlas first.');
} else {
  await Product.insertMany(products);
  console.log(`[Seed] ✅ ${products.length} products inserted successfully!`);
}

await mongoose.disconnect();
console.log('[Seed] Done.');
process.exit(0);