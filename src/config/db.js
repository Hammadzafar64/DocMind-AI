const mongoose = require('mongoose');
const logger = require('./logger');

let isConnected = false;

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/docmind_ai';
  
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 1500
    });
    isConnected = true;
    logger.info(`🟢 MongoDB Connected successfully to ${mongoURI}`);
  } catch (err) {
    isConnected = false;
    logger.warn(`⚠️ MongoDB Connection Warning: ${err.message}`);
    logger.warn(`⚠️ Running with resilient Local Memory Store fallback for MongoDB.`);
  }
};

const isDBConnected = () => isConnected;

module.exports = { connectDB, isDBConnected };
