// src/routes/subscriberRoutes.js
import express from 'express';
import Subscriber from '../models/Subscriber.js';
import { sendSubscriberWelcome } from '../services/emailService.js';

const router = express.Router();

// POST /api/subscribe
router.post('/', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    const existing = await Subscriber.findOne({ email });
    if (existing) {
      if (!existing.active) {
        existing.active = true;
        await existing.save();
        return res.json({ message: 'Welcome back! You are re-subscribed.' });
      }
      return res.json({ message: 'You are already subscribed!' });
    }

    await Subscriber.create({ email });
    await sendSubscriberWelcome(email);
    res.json({ message: 'Subscribed! Check your inbox.' });
  } catch (err) {
    console.error('[Subscribe]', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET /api/subscribe/unsubscribe?email=x
router.get('/unsubscribe', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).send('Invalid link');
  await Subscriber.findOneAndUpdate({ email }, { active: false });
  res.send('<p style="font-family:sans-serif;text-align:center;padding:40px;">You have been unsubscribed from Vintage808 emails.</p>');
});

export default router;