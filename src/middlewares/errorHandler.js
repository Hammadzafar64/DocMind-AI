const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  logger.error(`API Error on ${req.method} ${req.originalUrl}: ${err.message}`);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File size exceeds maximum limit of 25 MB.' });
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

module.exports = errorHandler;
