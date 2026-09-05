const logger = require('../config/logger');
const ollamaService = require('./ollamaService');
const geminiService = require('./geminiService');
const vectorStoreService = require('./vectorStoreService');

/**
 * Split text into chunks optimized for RAG
 * Chunk size: ~300-500 tokens (~1200 - 2000 chars) with ~50 token overlap (~200 chars)
 */
function chunkText(text, chunkSize = 1500, overlap = 250) {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?]+[.!?]+(\s+|$)/g) || [clean];
  const chunks = [];
  let current = '';
  let idx = 0;

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      const words = current.trim().split(/\s+/);
      const tokenEst = Math.round(current.length / 4);
      chunks.push({ id: idx++, text: current.trim(), tokenCount: tokenEst });
      
      const overlapWords = words.slice(-Math.min(30, words.length)).join(' ');
      current = overlapWords + ' ' + sentence;
    } else {
      current += sentence;
    }
  }
  
  if (current.trim()) {
    const tokenEst = Math.round(current.trim().length / 4);
    chunks.push({ id: idx++, text: current.trim(), tokenCount: tokenEst });
  }

  return chunks;
}

/** Fallback Extractive Q&A engine - returns ONLY the direct, relevant answer without extra fluff */
function extractiveAnswer(question, chunks) {
  const STOP = new Set(['the','is','at','which','on','a','an','and','or','in','of','to','for','with','it','this','that','what','how','why','who','where','when','can','could','would','should','do','does','did']);
  const cleanQuestion = question.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const tokens = cleanQuestion.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));

  if (tokens.length === 0 || !chunks || chunks.length === 0) {
    return '⚠️ This information is not found in the uploaded document.';
  }

  const candidateSentences = [];

  chunks.forEach(chunk => {
    // Strip markdown headers, hashes, bullet symbols, and excessive formatting
    const cleanedText = chunk.text
      .replace(/^#{1,6}\s+.+$/gm, '') // remove markdown headers
      .replace(/^[*\-+]\s+/gm, '')    // remove bullet markers
      .replace(/\r\n/g, '\n')
      .trim();

    const rawSentences = cleanedText.match(/[^.!?\n]+[.!?]+(\s+|$)/g) || [cleanedText];

    rawSentences.forEach(s => {
      const trimmed = s.replace(/\s+/g, ' ').trim();
      // Only consider meaningful natural sentences
      if (trimmed.length >= 20 && !trimmed.startsWith('#') && !trimmed.startsWith('==')) {
        candidateSentences.push({
          text: trimmed,
          chunkId: chunk.id,
          score: 0
        });
      }
    });
  });

  const queryHasNumberQuestion = /\b(percentage|percent|average|rate|gain|number|how many|how much|metric|figure|date|year)\b/i.test(question);

  candidateSentences.forEach(s => {
    const lower = s.text.toLowerCase();
    
    // Check for direct token hits
    tokens.forEach(t => {
      if (lower.includes(t)) {
        s.score += 3;
      }
    });

    // Check for exact phrase matches
    if (cleanQuestion.length > 8 && lower.includes(cleanQuestion)) {
      s.score += 15;
    }

    // Boost if question asks for numbers/metrics and sentence has digits/percentages
    if (queryHasNumberQuestion && /\b\d+(\.\d+)?%?|\b\d{4}\b/.test(s.text)) {
      s.score += 4;
    }

    // Penalize sentences that are just title-like or too long
    if (s.text.length > 280) s.score -= 2;
  });

  candidateSentences.sort((a, b) => b.score - a.score);
  const bestMatches = candidateSentences.filter(s => s.score > 2);

  if (bestMatches.length > 0) {
    // Return only the most direct matching sentence (or 2 if closely related)
    const primary = bestMatches[0].text;
    if (bestMatches.length > 1 && bestMatches[1].score >= bestMatches[0].score * 0.8 && bestMatches[0].text.length < 100) {
      return `${primary} ${bestMatches[1].text}`;
    }
    return primary;
  }

  return '⚠️ This information is not found in the uploaded document.';
}

/** Extractive summary fallback for Summarizer Tab */
function extractiveSummary(text, mode = 'bullets') {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+(\s+|$)/g) || [clean];
  if (sentences.length <= 2) return clean;

  const STOP = new Set(['the','is','at','which','on','a','an','and','or','in','of','to','for','with','it','this','that','are','was','were','be','been','have','has','had']);
  const freq = {};
  clean.toLowerCase().replace(/[^\w\s]/g,'').split(/\s+/).forEach(w => {
    if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  });

  const scored = sentences.map((s, i) => {
    let score = 0;
    s.toLowerCase().replace(/[^\w\s]/g,'').split(/\s+/).forEach(w => { if (freq[w]) score += freq[w]; });
    if (i === 0) score *= 1.5;
    if (i === sentences.length - 1) score *= 1.2;
    return { text: s.trim(), score, idx: i };
  });
  scored.sort((a, b) => b.score - a.score);

  if (mode === 'tldr') {
    return scored.slice(0, 2).sort((a, b) => a.idx - b.idx).map(s => s.text).join(' ');
  }
  if (mode === 'bullets') {
    return scored.slice(0, Math.min(5, sentences.length))
      .sort((a, b) => a.idx - b.idx)
      .map(s => `• ${s.text}`).join('\n');
  }
  if (mode === 'executive') {
    return scored.slice(0, Math.min(4, sentences.length))
      .sort((a, b) => a.idx - b.idx).map(s => s.text).join(' ');
  }
  return scored.slice(0, Math.min(6, sentences.length))
    .sort((a, b) => a.idx - b.idx).map(s => s.text).join('\n\n');
}

/** Clean up direct answer by removing filler preambles */
function cleanDirectAnswer(rawAnswer) {
  if (!rawAnswer) return '';
  let cleaned = rawAnswer.trim();

  // Strip preambles like "Based on the provided excerpts, ..."
  cleaned = cleaned.replace(/^(Based on the (provided )?document( excerpts)?|According to the (document|excerpts)|From the provided text)[,:]\s*/i, '');
  cleaned = cleaned.replace(/^DIRECT ANSWER:\s*/i, '');

  return cleaned.trim();
}

/** Execute Q&A RAG Pipeline with Conversation History */
async function answerQuestion({ question, docId, docName = 'Document', conversationHistory = [] }) {
  // 1. Retrieve top chunks using persistent vector store
  const topChunks = await vectorStoreService.searchVectorStore(question, docId, 6);
  
  const sources = topChunks.map(c => c.text);
  const contextText = topChunks.map((c, i) => `[Excerpt ${i + 1}]:\n${c.text}`).join('\n\n');

  // Format last 3 conversation history items into memory string
  let historyText = '';
  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-3);
    historyText = 'RECENT CONVERSATION:\n' + recent.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n') + '\n\n';
  }

  const settings = ollamaService.getSettings();
  const ollamaStatus = await ollamaService.checkOllamaStatus();

  let answer = '';
  let engine = 'local';

  // System Prompt strictly instructing a direct, concise answer with ZERO extra fluff
  const sysPrompt = `You are DocMind AI, a direct and precise document question-answering assistant.
Your task is to answer the user's question using ONLY the provided document context from "${docName}".

STRICT GUIDELINES:
1. Answer ONLY the specific question asked. Give the exact, direct answer.
2. Do NOT add extra background, do NOT add unsolicited commentary or preambles.
3. Do NOT create arbitrary sections, headers, or bullet points unless the user specifically asks for a list.
4. If the user asks for a specific number, metric, percentage, date, name, or detail, state that exact fact clearly and directly.
5. If the provided context does NOT contain the answer, reply ONLY with:
"⚠️ This information is not found in the uploaded document."`;

  const fullPrompt = `${historyText}DOCUMENT CONTEXT:\n${contextText}\n\nUSER QUESTION: ${question}\n\nDIRECT ANSWER:`;

  if (settings.provider === 'ollama' && ollamaStatus.online) {
    try {
      answer = await ollamaService.generateResponse(fullPrompt, sysPrompt);
      engine = `Ollama (${settings.selectedModel || 'llama3.2:3b'})`;
    } catch (err) {
      logger.error(`Ollama Q&A generation failed: ${err.message}`);
    }
  }

  if (!answer && settings.geminiApiKey) {
    try {
      answer = await geminiService.generateGeminiResponse(fullPrompt, sysPrompt);
      engine = 'Google Gemini 1.5 Flash';
    } catch (err) {
      logger.error(`Gemini Q&A generation failed: ${err.message}`);
    }
  }

  if (!answer) {
    answer = extractiveAnswer(question, topChunks);
    engine = 'Local Engine (Extractive)';
  } else {
    answer = cleanDirectAnswer(answer);
  }

  return {
    answer,
    reply: answer,
    engine,
    sources: sources.slice(0, 4)
  };
}

/** Execute Document / Text Summarization */
async function generateSummary({ text, docName = 'Document', mode = 'bullets' }) {
  const truncatedText = text.substring(0, 8000);
  const settings = ollamaService.getSettings();
  const ollamaStatus = await ollamaService.checkOllamaStatus();

  const modePrompts = {
    bullets: 'Provide the key highlights in a clean, concise bulleted list under "### ✨ Key Highlights".',
    tldr: 'Provide a very brief TL;DR summary in 2 sentences.',
    executive: 'Write a professional executive summary with key takeaways and findings.',
    detailed: 'Provide a comprehensive section-by-section breakdown.'
  };

  const modeDesc = modePrompts[mode] || modePrompts.bullets;
  const sysPrompt = `You are DocMind AI. Summarize the following content ("${docName}"). ${modeDesc} Use clean markdown.`;
  const prompt = `CONTENT TO SUMMARIZE:\n${truncatedText}\n\nSUMMARY:`;

  let summary = '';
  let engine = 'local';

  if (settings.provider === 'ollama' && ollamaStatus.online) {
    try {
      summary = await ollamaService.generateResponse(prompt, sysPrompt);
      engine = `Ollama (${settings.selectedModel || 'llama3.2:3b'})`;
    } catch (err) {
      logger.error(`Ollama summarization failed: ${err.message}`);
    }
  }

  if (!summary && settings.geminiApiKey) {
    try {
      summary = await geminiService.generateGeminiResponse(prompt, sysPrompt);
      engine = 'Google Gemini 1.5 Flash';
    } catch (err) {
      logger.error(`Gemini summarization failed: ${err.message}`);
    }
  }

  if (!summary) {
    summary = extractiveSummary(truncatedText, mode);
    engine = 'Local Engine (Extractive)';
  }

  return {
    summary,
    reply: summary,
    mode,
    engine
  };
}

module.exports = {
  chunkText,
  answerQuestion,
  generateSummary
};
