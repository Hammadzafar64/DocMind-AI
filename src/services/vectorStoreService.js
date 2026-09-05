const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const ollamaService = require('./ollamaService');

const storageDir = path.join(__dirname, '../../storage');
const storeFilePath = path.join(storageDir, 'vector_store.json');

if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// In-memory collection of persistent vector nodes
let vectorNodes = [];

// Stop words for text vectorization fallback
const STOP_WORDS = new Set(['the','is','at','which','on','a','an','and','or','in','of','to','for',
  'with','it','this','that','what','how','why','who','where','when','are','was','were',
  'be','been','being','have','has','had','do','does','did','but','by','from','this','that']);

/** Load vector store index from disk */
function loadStore() {
  try {
    if (fs.existsSync(storeFilePath)) {
      const data = fs.readFileSync(storeFilePath, 'utf8');
      vectorNodes = JSON.parse(data);
      logger.info(`📦 VectorStore loaded ${vectorNodes.length} vector nodes from disk.`);
    }
  } catch (err) {
    logger.error(`Failed to load vector store from disk: ${err.message}`);
    vectorNodes = [];
  }
}

/** Save vector store index to disk */
function saveStore() {
  try {
    fs.writeFileSync(storeFilePath, JSON.stringify(vectorNodes, null, 2), 'utf8');
  } catch (err) {
    logger.error(`Failed to save vector store to disk: ${err.message}`);
  }
}

/** Compute term vector for local fallback similarity */
function buildTermFrequencyMap(text) {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const freq = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });
  return freq;
}

/** Cosine similarity between dense float arrays */
function cosineSimilarityDense(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Cosine similarity between term frequency maps */
function cosineSimilaritySparse(freqA, freqB) {
  const keys = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  let dot = 0, normA = 0, normB = 0;
  keys.forEach(key => {
    const valA = freqA[key] || 0;
    const valB = freqB[key] || 0;
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  });
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Add document chunks to persistent vector store */
async function indexDocumentChunks(docId, chunks, userId = 'guest') {
  // Remove existing nodes for this docId first
  vectorNodes = vectorNodes.filter(n => n.docId !== docId);

  for (const chunk of chunks) {
    const embedding = await ollamaService.generateEmbedding(chunk.text);
    const tfMap = buildTermFrequencyMap(chunk.text);

    const node = {
      id: `vec_${docId}_${chunk.id}`,
      docId: docId,
      chunkId: chunk.id,
      userId: userId,
      text: chunk.text,
      denseVector: embedding, // Array of floats or null
      tfMap: tfMap,
      createdAt: new Date().toISOString()
    };

    vectorNodes.push(node);
  }

  saveStore();
  logger.info(`✅ Indexed ${chunks.length} chunks into persistent vector store for docId: ${docId}`);
}

/** Search persistent vector store for top K matches */
async function searchVectorStore(query, targetDocId = null, topK = 6) {
  if (vectorNodes.length === 0) return [];

  // Filter nodes if targetDocId is specified
  const candidateNodes = targetDocId 
    ? vectorNodes.filter(n => n.docId === targetDocId)
    : vectorNodes;

  if (candidateNodes.length === 0) return [];

  const queryEmbedding = await ollamaService.generateEmbedding(query);
  const queryTfMap = buildTermFrequencyMap(query);

  const scored = candidateNodes.map(node => {
    let score = 0;
    
    if (queryEmbedding && node.denseVector) {
      score = cosineSimilarityDense(queryEmbedding, node.denseVector);
    } else {
      score = cosineSimilaritySparse(queryTfMap, node.tfMap);
    }

    // Exact string match bonus
    const lowerText = node.text.toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    if (lowerText.includes(lowerQuery)) {
      score += 0.35;
    }

    return {
      docId: node.docId,
      chunkId: node.chunkId,
      text: node.text,
      score: score
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/** Delete vectors associated with docId */
function deleteDocumentVectors(docId) {
  const initialLen = vectorNodes.length;
  vectorNodes = vectorNodes.filter(n => n.docId !== docId);
  if (vectorNodes.length !== initialLen) {
    saveStore();
    logger.info(`🗑️ Deleted vector entries for docId: ${docId}`);
  }
}

// Initial load
loadStore();

module.exports = {
  indexDocumentChunks,
  searchVectorStore,
  deleteDocumentVectors
};
