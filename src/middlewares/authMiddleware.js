const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'docmind_ai_super_secret_jwt_key_2026';

/**
 * Optional/Soft authentication middleware.
 * Attaches decoded user to req.user if valid token provided;
 * falls back to guest user if no token or invalid token.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = { id: 'guest', email: 'guest@docmind.ai', name: 'Guest User', role: 'guest' };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = { id: 'guest', email: 'guest@docmind.ai', name: 'Guest User', role: 'guest' };
      return next();
    }
    req.user = user;
    next();
  });
}

/**
 * Strict authentication middleware.
 * Returns 401 Unauthorized if token is missing, invalid, or expired.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token provided.',
      code: 'AUTH_REQUIRED'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token. Please log in again.',
        code: 'TOKEN_INVALID'
      });
    }
    req.user = user;
    next();
  });
}

/**
 * Role-based authorization middleware.
 * Ensures the authenticated user has one of the allowed roles.
 * Returns 401 if unauthenticated, 403 Forbidden if role insufficient.
 *
 * @param  {...string} roles - e.g. 'admin', 'user'
 */
function requireRole(...roles) {
  return (req, res, next) => {
    // If not authenticated or guest
    if (!req.user || req.user.id === 'guest') {
      return res.status(401).json({
        success: false,
        error: 'Authentication required before accessing this protected resource.',
        code: 'AUTH_REQUIRED'
      });
    }

    // Role check: 403 Forbidden when authenticated identity does not have permission
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access forbidden: Required role [${roles.join(', ')}], but current user role is '${req.user.role}'.`,
        code: 'FORBIDDEN_ROLE'
      });
    }

    next();
  };
}

module.exports = { authenticateToken, requireAuth, requireRole, JWT_SECRET };
