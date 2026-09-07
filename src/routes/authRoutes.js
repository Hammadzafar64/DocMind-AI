const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiter');

// Public Authentication endpoints (Identity verification)
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// Strict Authenticated Profile endpoint (Authentication required)
router.get('/me', requireAuth, authController.getMe);

// Role-based Protected Admin endpoints (Authentication + Authorization required)
router.get('/admin/dashboard', requireAuth, requireRole('admin'), authController.getAdminDashboard);
router.get('/admin/users', requireAuth, requireRole('admin'), authController.listUsers);

module.exports = router;
