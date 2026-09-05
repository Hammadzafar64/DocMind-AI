require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./src/config/db');
const logger = require('./src/config/logger');
const { apiLimiter } = require('./src/middlewares/rateLimiter');
const errorHandler = require('./src/middlewares/errorHandler');

const authRoutes = require('./src/routes/authRoutes');
const docRoutes = require('./src/routes/docRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const ollamaService = require('./src/services/ollamaService');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database Connection
connectDB();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api', apiLimiter);

// Static file serving with strict cache control for PWA & Chrome cache purging
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', settingsRoutes);
app.use('/api', docRoutes);
app.use('/api', chatRoutes);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start Server
app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`🚀 DocMind AI Server running at http://localhost:${PORT}`);
  
  const ollama = await ollamaService.checkOllamaStatus();
  if (ollama.online) {
    logger.info(`🟢 Connected to Ollama (${ollama.activeModel}) on ${ollamaService.getSettings().ollamaHost}`);
  } else {
    logger.warn(`⚠️ Ollama not detected. Local Extractive Engine active.`);
  }
});
