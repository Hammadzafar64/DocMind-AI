const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { isDBConnected } = require('../config/db');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'docmind_ai_super_secret_jwt_key_2026';

// In-memory fallback users store if DB is disconnected
const inMemoryUsers = new Map();

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (isDBConnected()) {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists.' });
      }

      const user = await User.create({ name, email: cleanEmail, password });
      const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

      return res.status(201).json({
        success: true,
        token,
        user: { id: user._id, name: user.name, email: user.email }
      });
    } else {
      if (inMemoryUsers.has(cleanEmail)) {
        return res.status(400).json({ error: 'User with this email already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = 'usr_' + Date.now();
      const userObj = { id: userId, name, email: cleanEmail, password: hashedPassword };

      inMemoryUsers.set(cleanEmail, userObj);
      const token = jwt.sign({ id: userId, email: cleanEmail, name }, JWT_SECRET, { expiresIn: '7d' });

      return res.status(201).json({
        success: true,
        token,
        user: { id: userId, name, email: cleanEmail }
      });
    }
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (isDBConnected()) {
      const user = await User.findOne({ email: cleanEmail }).select('+password');
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        token,
        user: { id: user._id, name: user.name, email: user.email }
      });
    } else {
      const user = inMemoryUsers.get(cleanEmail);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        token,
        user: { id: user.id, name: user.name, email: user.email }
      });
    }
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  res.json({
    success: true,
    user: req.user
  });
}

module.exports = { register, login, getMe };
