const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  id: Number,
  text: String,
  tokenCount: Number,
  vectorId: String
});

const documentSchema = new mongoose.Schema({
  docId: {
    type: String,
    required: true,
    unique: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String
  },
  fileSize: {
    type: Number,
    required: true
  },
  formattedSize: {
    type: String,
    required: true
  },
  wordCount: {
    type: Number,
    default: 0
  },
  fullText: {
    type: String,
    required: true
  },
  chunks: [chunkSchema],
  chunksCount: {
    type: Number,
    default: 0
  },
  userId: {
    type: String,
    default: 'guest'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.Document || mongoose.model('Document', documentSchema);
