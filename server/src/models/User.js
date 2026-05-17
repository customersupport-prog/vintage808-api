// src/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' },
  street: String,
  city: String,
  province: String,
  postal: String,
  isDefault: { type: Boolean, default: false },
});

const returnItemSchema = new mongoose.Schema({
  productId: String,
  name: String,
  price: Number,
  size: String,
  quantity: Number,
  image: String,
});

const returnRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  orderRef: String,
  items: [returnItemSchema],
  reason: String,
  comments: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  name: String,
  firstName: String,
  lastName: String,
  resetOtp: { type: String, default: null },
  resetOtpExpiry: { type: Date, default: null },
  resetOtpVerified: { type: Boolean, default: false },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  // Optional — Google OAuth users have no password
  password: {
    type: String,
    default: null,
  },

  // Google OAuth
  googleId: { type: String, default: null },
  avatar: { type: String, default: null },

  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  isBanned: { type: Boolean, default: false },

  // Profile
  phone: { type: String, default: '' },
  dateOfBirth: { type: Date },

  // Preferences
  preferences: {
    sizes: { type: [String], default: [] },
    newsletter: { type: Boolean, default: false },
    smsMarketing: { type: Boolean, default: false },
  },

  addresses: [addressSchema],
  returns: [returnRequestSchema],

}, { 
  timestamps: true 
});

// Hash password before save — async without next (Mongoose 6+)
userSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password — returns false for Google-only accounts
userSchema.methods.matchPassword = async function (entered) {
  if (!this.password) return false;
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model('User', userSchema);