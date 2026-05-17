// src/middleware/requireAdmin.js

/**
 * Middleware that blocks access unless the authenticated user
 * has an 'admin' or 'superadmin' role.
 *
 * Must be used AFTER the `protect` middleware (which attaches req.user).
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

/**
 * Stricter variant — superadmin only.
 * Use on routes like assigning the superadmin role or deleting admins.
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Super Admin access required' });
  }
  next();
}