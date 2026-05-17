// src/routes/paystackRoutes.js
import express from 'express';
import { initializePayment, verifyPayment, webhook } from '../controllers/paystackController.js';

const router = express.Router();

// Webhook must use raw body — register before express.json() parses it
// (handled in app.js — see note below)
router.post('/webhook',    webhook);
router.post('/initialize', initializePayment);
router.post('/verify',     verifyPayment);


export default router;