const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Document = require('../models/Document');
const { isDBConnected } = require('../config/db');
const ragService = require('../services/ragService');
const vectorStoreService = require('../services/vectorStoreService');
const logger = require('../config/logger');

// Resilient memory store fallback if MongoDB server isn't active
const inMemoryDocs = new Map();

/** Helper to format file size */
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function uploadDocument(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const fileSize = req.file.size || fs.statSync(filePath).size;
    const formattedSize = formatBytes(fileSize);
    const userId = req.user ? req.user.id : 'guest';

    let text = '';

    if (ext === '.pdf') {
      const buf = fs.readFileSync(filePath);
      const pdfData = await pdfParse(buf);
      text = pdfData.text;
    } else if (ext === '.docx' || ext === '.doc') {
      const docxData = await mammoth.extractRawText({ path: filePath });
      text = docxData.value;
    } else {
      text = fs.readFileSync(filePath, 'utf8');
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Could not extract text from document. File may be empty or unreadable.' });
    }

    const docId = 'doc_' + Date.now();
    const wordCount = text.trim().split(/\s+/).length;

    // Optimized chunking (300-500 tokens with overlap)
    const chunks = ragService.chunkText(text);

    // Index chunks into persistent vector store
    await vectorStoreService.indexDocumentChunks(docId, chunks, userId);

    const docObj = {
      docId,
      filename: req.file.filename || docId,
      originalName: req.file.originalname,
      filePath,
      fileSize,
      formattedSize,
      wordCount,
      fullText: text,
      chunks,
      chunksCount: chunks.length,
      userId,
      uploadedAt: new Date()
    };

    if (isDBConnected()) {
      await Document.create(docObj);
    }
    inMemoryDocs.set(docId, docObj);

    logger.info(`📄 Document uploaded: "${req.file.originalname}" (${formattedSize}) by user: ${userId}`);

    res.json({
      success: true,
      docId: docId,
      name: req.file.originalname,
      wordCount: wordCount,
      size: fileSize,
      formattedSize: formattedSize,
      document: {
        id: docId,
        docId: docId,
        name: req.file.originalname,
        size: fileSize,
        formattedSize: formattedSize,
        wordCount: wordCount,
        chunksCount: chunks.length
      }
    });
  } catch (err) {
    next(err);
  }
}

async function listDocuments(req, res, next) {
  try {
    let docs = [];

    if (isDBConnected()) {
      const dbDocs = await Document.find({}).sort({ uploadedAt: -1 });
      docs = dbDocs.map(d => ({
        id: d.docId || d._id,
        docId: d.docId || d._id,
        name: d.originalName || d.filename,
        size: d.fileSize,
        formattedSize: d.formattedSize || formatBytes(d.fileSize),
        wordCount: d.wordCount,
        chunksCount: d.chunksCount,
        uploadedAt: d.uploadedAt
      }));
    } else {
      docs = Array.from(inMemoryDocs.values()).map(d => ({
        id: d.docId,
        docId: d.docId,
        name: d.originalName,
        size: d.fileSize,
        formattedSize: d.formattedSize || formatBytes(d.fileSize),
        wordCount: d.wordCount,
        chunksCount: d.chunksCount,
        uploadedAt: d.uploadedAt
      }));
    }

    res.json({ success: true, documents: docs });
  } catch (err) {
    next(err);
  }
}

async function getDocument(req, res, next) {
  try {
    const docId = req.params.id;
    let doc = inMemoryDocs.get(docId);

    if (!doc && isDBConnected()) {
      const dbDoc = await Document.findOne({ docId });
      if (dbDoc) doc = dbDoc;
    }

    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    res.json({
      success: true,
      document: {
        id: doc.docId || doc._id,
        docId: doc.docId || doc._id,
        name: doc.originalName || doc.filename,
        size: doc.fileSize,
        formattedSize: doc.formattedSize || formatBytes(doc.fileSize),
        wordCount: doc.wordCount,
        chunksCount: doc.chunksCount,
        uploadedAt: doc.uploadedAt,
        textSnippet: (doc.fullText || '').substring(0, 500) + '...'
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getDocumentText(req, res, next) {
  try {
    const docId = req.params.id;
    let doc = inMemoryDocs.get(docId);

    if (!doc && isDBConnected()) {
      const dbDoc = await Document.findOne({ docId });
      if (dbDoc) doc = dbDoc;
    }

    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    res.json({
      success: true,
      name: doc.originalName || doc.filename,
      wordCount: doc.wordCount,
      text: doc.fullText
    });
  } catch (err) {
    next(err);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const docId = req.params.id;
    let doc = inMemoryDocs.get(docId);

    if (isDBConnected()) {
      const dbDoc = await Document.findOne({ docId });
      if (dbDoc) {
        doc = dbDoc;
        await Document.deleteOne({ docId });
      }
    }

    if (inMemoryDocs.has(docId)) {
      inMemoryDocs.delete(docId);
    }

    // Delete vectors from vector store
    vectorStoreService.deleteDocumentVectors(docId);

    if (doc && doc.filePath && fs.existsSync(doc.filePath)) {
      try { fs.unlinkSync(doc.filePath); } catch (e) {}
    }

    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

/** Get document reference for RAG controller (checks memory & DB) */
async function getDocumentFromStore(docId) {
  let doc = inMemoryDocs.get(docId);
  if (!doc && isDBConnected()) {
    const dbDoc = await Document.findOne({ docId });
    if (dbDoc) {
      doc = dbDoc.toObject ? dbDoc.toObject() : dbDoc;
      inMemoryDocs.set(docId, doc);
    }
  }
  return doc;
}

function getAllDocumentsFromStore() {
  return Array.from(inMemoryDocs.values());
}

module.exports = {
  uploadDocument,
  listDocuments,
  getDocument,
  getDocumentText,
  deleteDocument,
  getDocumentFromStore,
  getAllDocumentsFromStore
};
