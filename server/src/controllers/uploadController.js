// server/src/controllers/uploadController.js
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// ── Configure Cloudinary ──────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Multer — store in memory, not disk ───────────────────────
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  },
});

// ── Upload single image to Cloudinary ─────────────────────────
export const uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  try {
    // Upload buffer to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder:         'vintage808/products',
          transformation: [
            { width: 800, height: 900, crop: 'fill', gravity: 'center' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    res.json({
      success: true,
      message: 'Image uploaded',
      url:     result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
};

// ── Delete image from Cloudinary ──────────────────────────────
export const deleteImage = async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) {
    return res.status(400).json({ success: false, message: 'Public ID required' });
  }

  try {
    await cloudinary.uploader.destroy(publicId);
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Delete failed', error: error.message });
  }
};