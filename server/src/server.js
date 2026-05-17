import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors    from 'cors';
import path    from 'path';
import { fileURLToPath } from 'url';

import connectDB   from './config/db.js';
import { seedAdmin } from './controllers/adminController.js';

import productRoutes from './routes/productRoutes.js';
import authRoutes    from './routes/authRoutes.js';
import orderRoutes   from './routes/orderRoutes.js';
import adminRoutes   from './routes/adminRoutes.js';
import uploadRoutes  from './routes/uploadRoutes.js';
import subscriberRoutes from './routes/subscriberRoutes.js';
import { sendContactEmail } from './services/emailService.js';
import paystackRoutes from './routes/paystackRoutes.js';


const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Connect to MongoDB then seed admin ────────────────────────
connectDB().then(() => seedAdmin());

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
 origin: [
  'http://localhost:5500',   // Live Server default
  'http://127.0.0.1:5500',
  'http://localhost:5501',   // Live Server (second tab)
  'http://127.0.0.1:5501',
  'http://localhost:5173',   // Vite
  'https://vintage808-admin.vercel.app',
  'https://vintage808.co.za',
  'https://vintage808-sage.vercel.app',
  'https://www.vintage808.co.za',
  
],
  credentials: true,
}));
app.use(express.json());

// ── Static Images ─────────────────────────────────────────────
app.use(
  '/images',
  express.static(path.join(__dirname, '..', 'public', 'images'))
);
app.use(express.static(path.join(__dirname, '../client')));


// ── Routes ────────────────────────────────────────────────────
app.use('/api/products', productRoutes);
app.use('/api/auth',     authRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/paystack', paystackRoutes);
app.use('/api/upload',   uploadRoutes);   // ← was '/admin/upload', now '/api/upload'
app.use('/api/subscribe', subscriberRoutes);
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  try {
    await sendContactEmail({ name, email, message });
    res.json({ success: true, message: 'Message sent' });
  } catch (err) {
    console.error('[Contact] Email error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    mongo: process.env.MONGODB_URI ? 'set' : 'MISSING',
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

//  (local only) ────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;