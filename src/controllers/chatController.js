const ChatHistory = require('../models/ChatHistory');
const { isDBConnected } = require('../config/db');
const ragService = require('../services/ragService');
const docController = require('./docController');
const historyStore = require('../services/historyStoreService');
const logger = require('../config/logger');

// Resilient memory store for current-session runtime cache
const inMemoryChatHistory = new Map();

async function askQuestion(req, res, next) {
  try {
    const { docId, question, sessionId = 'default_session' } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const userId = req.user ? req.user.id : 'guest';
    let docName = 'Uploaded Document';

    if (docId) {
      const doc = await docController.getDocumentFromStore(docId);
      if (doc) docName = doc.originalName || doc.filename;
    }

    // Retrieve conversation history for context-aware Q&A memory
    let historyMessages = [];
    if (isDBConnected()) {
      const sessionHistory = await ChatHistory.findOne({ sessionId, userId });
      if (sessionHistory) historyMessages = sessionHistory.messages || [];
    } else {
      // Try file-based history first, then in-memory
      if (inMemoryChatHistory.has(sessionId)) {
        historyMessages = inMemoryChatHistory.get(sessionId);
      } else {
        const fileSession = historyStore.getSession(sessionId);
        if (fileSession) historyMessages = fileSession.messages || [];
      }
    }

    // Run RAG Q&A Pipeline
    const ragResult = await ragService.answerQuestion({
      question: question.trim(),
      docId,
      docName,
      conversationHistory: historyMessages
    });

    // Build messages to save
    const userMsg = { role: 'user', content: question.trim(), timestamp: new Date() };
    const botMsg = {
      role: 'assistant',
      content: ragResult.answer,
      engine: ragResult.engine,
      sources: ragResult.sources,
      timestamp: new Date()
    };

    if (isDBConnected()) {
      await ChatHistory.findOneAndUpdate(
        { sessionId, userId },
        {
          $setOnInsert: { sessionId, userId, docId },
          $push: { messages: { $each: [userMsg, botMsg] } },
          $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
      );
    }

    // Update in-memory cache
    const updatedMem = [...historyMessages, userMsg, botMsg];
    inMemoryChatHistory.set(sessionId, updatedMem);

    // Always persist to file-based history store
    historyStore.appendMessages(sessionId, userId, docId, docName, [userMsg, botMsg]);

    res.json({
      success: true,
      answer: ragResult.answer,
      reply: ragResult.answer,
      engine: ragResult.engine,
      sources: ragResult.sources,
      sessionId
    });
  } catch (err) {
    next(err);
  }
}

async function summarizeText(req, res, next) {
  try {
    const { docId, text, mode = 'bullets' } = req.body;
    let contentToSummarize = text || '';
    let docName = 'Provided Text';

    if (docId) {
      const doc = await docController.getDocumentFromStore(docId);
      if (doc) {
        contentToSummarize = doc.fullText;
        docName = doc.originalName || doc.filename;
      }
    }

    if (!contentToSummarize || !contentToSummarize.trim()) {
      return res.status(400).json({ error: 'No text or document provided to summarize.' });
    }

    const result = await ragService.generateSummary({
      text: contentToSummarize,
      docName,
      mode
    });

    res.json({
      success: true,
      summary: result.summary,
      reply: result.summary,
      mode: result.mode,
      engine: result.engine
    });
  } catch (err) {
    next(err);
  }
}

async function unifiedChat(req, res, next) {
  try {
    const { message, docId, sessionId = 'default_session' } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required.' });

    const msg = message.trim();
    const isSummarize = /(summarize|summarise|summary|tldr|tl;dr|tl dr|brief|overview|key points|highlights)/i.test(msg);

    if (isSummarize) {
      const mode = /tldr|tl;dr/i.test(msg) ? 'tldr' : 'bullets';
      let content = null;
      let docName = 'Document';

      if (docId) {
        const doc = await docController.getDocumentFromStore(docId);
        if (doc) {
          content = doc.fullText;
          docName = doc.originalName;
        }
      }

      if (!content) {
        const match = msg.match(/(?:summarize|summary|tldr)[:\s]+(.{20,})/is);
        if (match) content = match[1];
      }

      if (content) {
        const sumResult = await ragService.generateSummary({ text: content, docName, mode });
        const summaryReply = `### 📝 Summary\n\n${sumResult.summary}`;
        const userId = req.user ? req.user.id : 'guest';

        const userMsg = { role: 'user', content: msg, timestamp: new Date() };
        const botMsg = {
          role: 'assistant',
          content: summaryReply,
          engine: sumResult.engine,
          sources: [],
          timestamp: new Date()
        };

        if (isDBConnected()) {
          await ChatHistory.findOneAndUpdate(
            { sessionId, userId },
            {
              $setOnInsert: { sessionId, userId, docId },
              $push: { messages: { $each: [userMsg, botMsg] } },
              $set: { updatedAt: new Date() }
            },
            { upsert: true, new: true }
          );
        }

        const currentMem = inMemoryChatHistory.get(sessionId) || [];
        inMemoryChatHistory.set(sessionId, [...currentMem, userMsg, botMsg]);
        historyStore.appendMessages(sessionId, userId, docId, docName, [userMsg, botMsg]);

        return res.json({
          success: true,
          reply: summaryReply,
          type: 'summary',
          engine: sumResult.engine,
          sessionId
        });
      }
    }

    // Default to Q&A RAG execution
    req.body.question = message;
    return askQuestion(req, res, next);
  } catch (err) {
    next(err);
  }
}

async function getChatHistory(req, res, next) {
  try {
    const sessionId = req.query.sessionId || 'default_session';
    const userId = req.user ? req.user.id : 'guest';
    let messages = [];

    if (isDBConnected()) {
      const history = await ChatHistory.findOne({ sessionId, userId });
      if (history) messages = history.messages;
    } else {
      // Try in-memory first (current runtime), then file-based
      if (inMemoryChatHistory.has(sessionId)) {
        messages = inMemoryChatHistory.get(sessionId);
      } else {
        const fileSession = historyStore.getSession(sessionId);
        if (fileSession) {
          messages = fileSession.messages || [];
          // Populate runtime cache
          inMemoryChatHistory.set(sessionId, messages);
        }
      }
    }

    res.json({ success: true, sessionId, messages });
  } catch (err) {
    next(err);
  }
}

async function clearChatHistory(req, res, next) {
  try {
    const sessionId = req.body.sessionId || req.query.sessionId || 'default_session';
    const userId = req.user ? req.user.id : 'guest';

    if (isDBConnected()) {
      await ChatHistory.deleteOne({ sessionId, userId });
    }
    inMemoryChatHistory.delete(sessionId);

    // Delete from file-based store too
    historyStore.deleteSession(sessionId);

    res.json({ success: true, message: 'Chat history cleared successfully.' });
  } catch (err) {
    next(err);
  }
}

/** List all saved history sessions */
async function listHistorySessions(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 'guest';
    const sessions = historyStore.listSessions(userId);

    // Return session metadata without full messages (for sidebar listing)
    const sessionList = sessions.map(s => ({
      sessionId: s.sessionId,
      title: s.title || 'Chat Session',
      docName: s.docName || null,
      messageCount: (s.messages || []).length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));

    res.json({ success: true, sessions: sessionList });
  } catch (err) {
    next(err);
  }
}

/** Delete a specific session by ID */
async function deleteHistorySession(req, res, next) {
  try {
    const { sessionId } = req.params;
    historyStore.deleteSession(sessionId);
    inMemoryChatHistory.delete(sessionId);

    if (isDBConnected()) {
      const userId = req.user ? req.user.id : 'guest';
      await ChatHistory.deleteOne({ sessionId, userId });
    }

    res.json({ success: true, message: 'Session deleted.' });
  } catch (err) {
    next(err);
  }
}

/** Get full session data including all messages */
async function getHistorySession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const session = historyStore.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
}

/** Clear ALL history sessions */
async function clearAllHistory(req, res, next) {
  try {
    historyStore.clearAllSessions();
    inMemoryChatHistory.clear();

    if (isDBConnected()) {
      await ChatHistory.deleteMany({});
    }

    res.json({ success: true, message: 'All chat history cleared.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  askQuestion,
  summarizeText,
  unifiedChat,
  getChatHistory,
  clearChatHistory,
  listHistorySessions,
  deleteHistorySession,
  getHistorySession,
  clearAllHistory
};
