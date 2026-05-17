// src/controllers/authController.js
import bcrypt from 'bcrypt';
import jwt    from 'jsonwebtoken';
import fetch  from 'node-fetch';
import User   from '../models/User.js';
import Order  from '../models/Order.js';
import {
  sendWelcomeEmail,
  sendOtpEmail,
  sendReturnReceived,   // customer acknowledgement
  sendAdminReturnAlert, // admin ping on new return
} from '../services/emailService.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    secret,
    { expiresIn: '7d' }
  );
}

function safeUser(user) {
  return {
    id:        user._id,
    name:      user.name,
    firstName: user.firstName,
    lastName:  user.lastName,
    email:     user.email,
    role:      user.role,
    avatar:    user.avatar,
  };
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
export const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email:    email.toLowerCase().trim(),
      password, // pre-save hook in User.js hashes this — do NOT bcrypt.hash here
    });

    await sendWelcomeEmail(user);
    res.status(201).json({ success: true, message: 'User successfully registered' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({ success: true, token: signToken(user), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'No credential provided' });
    }

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const payload  = await response.json();

    if (payload.error || payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ success: false, message: 'Invalid Google token' });
    }

    const { sub, email, name, picture } = payload;
    let user = await User.findOne({ $or: [{ googleId: sub }, { email }] });

    if (!user) {
      user = await User.create({ name, email, googleId: sub, avatar: picture, password: null });
      await sendWelcomeEmail(user);
    } else if (!user.googleId) {
      user.googleId = sub;
      user.avatar   = user.avatar || picture;
      await user.save();
    }

    res.json({ success: true, token: signToken(user), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─────────────────────────────────────────────
// Password Reset
// ─────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Don't reveal whether the email exists
      return res.json({ success: true, message: 'If that email exists, an OTP has been sent' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp         = otp;
    user.resetOtpExpiry   = new Date(Date.now() + 10 * 60 * 1000);
    user.resetOtpVerified = false;
    await user.save();

    await sendOtpEmail(user, otp);
    res.json({ success: true, message: 'If that email exists, an OTP has been sent' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ success: false, message: 'No reset request found' });
    }
    if (user.resetOtpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired — please request a new one' });
    }
    if (user.resetOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    user.resetOtpVerified = true;
    await user.save();
    res.json({ success: true, message: 'OTP verified' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const resetPassword = async (req, res) => {
  const { email, password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.resetOtpVerified) {
      return res.status(400).json({ success: false, message: 'OTP not verified' });
    }

    // Assign plain text — pre-save hook hashes it. Do NOT bcrypt.hash here.
    user.password         = password;
    user.resetOtp         = null;
    user.resetOtpExpiry   = null;
    user.resetOtpVerified = false;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─────────────────────────────────────────────
// Profile & Preferences
// ─────────────────────────────────────────────
export const getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json({ success: true, data: user });
};

export const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json({ success: true, data: user });
};

export const updateProfile = async (req, res) => {
  const { firstName, lastName, email, phone, dateOfBirth, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (firstName   !== undefined) user.firstName   = firstName;
    if (lastName    !== undefined) user.lastName    = lastName;
    if (email       !== undefined) user.email       = email.toLowerCase().trim();
    if (phone       !== undefined) user.phone       = phone;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new one' });
      }
      if (!user.password) {
        return res.status(400).json({ success: false, message: 'Password login is not enabled for this account (Google sign-in)' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      }
      user.password = newPassword; // pre-save hook hashes it
    }

    user.name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    await user.save();
    res.json({ success: true, message: 'Profile updated', data: safeUser(user) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getPreferences = async (req, res) => {
  const user = await User.findById(req.user.id).select('preferences');
  res.json({ success: true, data: user?.preferences || {} });
};

export const updatePreferences = async (req, res) => {
  const user = await User.findById(req.user.id);
  user.preferences = { ...(user.preferences?.toObject?.() || {}), ...req.body };
  await user.save();
  res.json({ success: true, data: user.preferences });
};

// ─────────────────────────────────────────────
// Addresses
// ─────────────────────────────────────────────
export const getAddresses = async (req, res) => {
  const user = await User.findById(req.user.id).select('addresses');
  res.json({ success: true, data: user?.addresses || [] });
};

export const addAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (req.body.isDefault) user.addresses.forEach(a => (a.isDefault = false));
  user.addresses.push(req.body);
  await user.save();
  res.json({ success: true, data: user.addresses });
};

export const updateAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const addr = user.addresses.id(req.params.id);
  if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });

  Object.assign(addr, req.body);
  if (req.body.isDefault) {
    user.addresses.forEach(a => (a.isDefault = false));
    addr.isDefault = true;
  }
  await user.save();
  res.json({ success: true, data: user.addresses });
};

export const setDefaultAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  user.addresses.forEach(a => { a.isDefault = a._id.toString() === req.params.id; });
  await user.save();
  res.json({ success: true, data: user.addresses });
};

export const deleteAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  user.addresses = user.addresses.filter(a => a._id.toString() !== req.params.id);
  await user.save();
  res.json({ success: true, data: user.addresses });
};

// ─────────────────────────────────────────────
// Returns
// FIX: original called sendReturnRequest which doesn't exist.
// Now correctly imports and calls sendReturnReceived (customer)
// and sendAdminReturnAlert (admin) which are both in emailService.js
// ─────────────────────────────────────────────
export const createReturn = async (req, res) => {
  const { orderId, items, reason, comments } = req.body;
  if (!orderId || !items?.length || !reason) {
    return res.status(400).json({ success: false, message: 'Invalid return data' });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const user     = await User.findById(req.user.id);
    const orderRef = `#${orderId.toString().slice(-6).toUpperCase()}`;

    const returnDoc = { orderId, orderRef, items, reason, comments, status: 'pending' };
    user.returns.push(returnDoc);
    await user.save();

    // Build an order-like object the email templates expect
    const emailOrder = {
      ...order.toObject(),
      customerName: user.name,
      return: { reason, status: 'pending' },
    };

    sendReturnReceived(emailOrder, user.email).catch(console.error);
    sendAdminReturnAlert(emailOrder, user.email).catch(console.error);

    res.status(201).json({ success: true, data: returnDoc });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getReturns = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('returns');
    res.json({ success: true, data: user?.returns ?? [] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};