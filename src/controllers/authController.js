const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { isDBConnected } = require('../config/db');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'docmind_ai_super_secret_jwt_key_2026';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'docmind_admin_key_2026';

// In-memory fallback users store if DB is disconnected
const inMemoryUsers = new Map();

/**
 * Register a new user
 * By default creates a 'user' role.
 * Assigns 'admin' role if valid adminSecret is provided.
 */
async function register(req, res, next) {
  try {
    const { name, email, password, adminSecret } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Determine role: assign admin only if adminSecret matches configured key
    let assignedRole = 'user';
    if (adminSecret && adminSecret === ADMIN_SECRET_KEY) {
      assignedRole = 'admin';
    }

    if (isDBConnected()) {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'User with this email already exists.' });
      }

      const user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        password,
        role: assignedRole
      });

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        success: true,
        message: 'Registration successful.',
        token,
        user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role }
      });
    } else {
      // In-memory mode fallback
      if (inMemoryUsers.has(cleanEmail)) {
        return res.status(400).json({ success: false, error: 'User with this email already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = 'usr_' + Date.now();
      const userObj = {
        id: userId,
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: assignedRole,
        createdAt: new Date()
      };

      inMemoryUsers.set(cleanEmail, userObj);

      const token = jwt.sign(
        { id: userId, email: cleanEmail, name: userObj.name, role: assignedRole },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        success: true,
        message: 'Registration successful.',
        token,
        user: { id: userId, name: userObj.name, email: cleanEmail, role: assignedRole }
      });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Login existing user
 * Verifies password with bcrypt and signs JWT containing user role.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (isDBConnected()) {
      const user = await User.findOne({ email: cleanEmail }).select('+password');
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const role = user.role || 'user';
      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, name: user.name, role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: 'Login successful.',
        token,
        user: { id: user._id.toString(), name: user.name, email: user.email, role }
      });
    } else {
      // In-memory mode
      const user = inMemoryUsers.get(cleanEmail);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const role = user.role || 'user';
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: 'Login successful.',
        token,
        user: { id: user.id, name: user.name, email: user.email, role }
      });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Get current authenticated user profile
 */
async function getMe(req, res) {
  res.json({
    success: true,
    user: req.user
  });
}

/**
 * Admin Dashboard - Protected by [requireAuth, requireRole('admin')]
 */
async function getAdminDashboard(req, res) {
  const isDb = isDBConnected();
  let userCount = 0;

  if (isDb) {
    userCount = await User.countDocuments();
  } else {
    userCount = inMemoryUsers.size;
  }

  res.json({
    success: true,
    message: 'Welcome to the DocMind-AI Admin Dashboard.',
    admin: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    },
    system: {
      environment: process.env.NODE_ENV || 'development',
      database: isDb ? 'MongoDB Connected' : 'In-Memory Fallback Active',
      totalRegisteredUsers: userCount,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * List all users - Protected by [requireAuth, requireRole('admin')]
 */
async function listUsers(req, res) {
  if (isDBConnected()) {
    const users = await User.find().select('-password');
    return res.json({ success: true, count: users.length, users });
  } else {
    const users = Array.from(inMemoryUsers.values()).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt
    }));
    return res.json({ success: true, count: users.length, users });
  }
}

module.exports = {
  register,
  login,
  getMe,
  getAdminDashboard,
  listUsers,
  inMemoryUsers
};
