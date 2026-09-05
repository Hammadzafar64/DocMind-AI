const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Core chat / Q&A / Summarize
router.post('/qa', authenticateToken, chatController.askQuestion);
router.post('/summarize', authenticateToken, chatController.summarizeText);
router.post('/chat', authenticateToken, chatController.unifiedChat);

// Per-session history (current active session)
router.get('/chat/history', authenticateToken, chatController.getChatHistory);
router.delete('/chat/history', authenticateToken, chatController.clearChatHistory);

// All history sessions management
router.get('/history/sessions', authenticateToken, chatController.listHistorySessions);
router.get('/history/sessions/:sessionId', authenticateToken, chatController.getHistorySession);
router.delete('/history/sessions/:sessionId', authenticateToken, chatController.deleteHistorySession);
router.delete('/history/all', authenticateToken, chatController.clearAllHistory);

module.exports = router;
