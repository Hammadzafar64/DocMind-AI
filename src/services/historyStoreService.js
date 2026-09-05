const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const storageDir = path.join(__dirname, '../../storage');
const historyFilePath = path.join(storageDir, 'chat_history.json');

if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

/** Load all sessions from disk */
function loadAllSessions() {
  try {
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    logger.error(`Failed to load chat history from disk: ${err.message}`);
  }
  return {};
}

/** Save all sessions to disk */
function saveAllSessions(sessions) {
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (err) {
    logger.error(`Failed to save chat history to disk: ${err.message}`);
  }
}

/** Get single session by sessionId */
function getSession(sessionId) {
  const sessions = loadAllSessions();
  return sessions[sessionId] || null;
}

/** Save / update a single session */
function saveSession(sessionId, sessionData) {
  const sessions = loadAllSessions();
  sessions[sessionId] = {
    ...sessionData,
    updatedAt: new Date().toISOString()
  };
  saveAllSessions(sessions);
}

/** Delete a single session */
function deleteSession(sessionId) {
  const sessions = loadAllSessions();
  if (sessions[sessionId]) {
    delete sessions[sessionId];
    saveAllSessions(sessions);
    return true;
  }
  return false;
}

/** List all sessions (sorted by updatedAt desc) */
function listSessions(userId = null) {
  const sessions = loadAllSessions();
  let list = Object.values(sessions);
  // If specific logged-in user, filter by their userId or guest/unassigned sessions
  if (userId && userId !== 'guest') {
    list = list.filter(s => !s.userId || s.userId === userId || s.userId === 'guest');
  }
  // Sort by updatedAt descending (or createdAt fallback)
  list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  return list;
}

/** Delete all sessions */
function clearAllSessions() {
  saveAllSessions({});
}

/** Append messages to a session */
function appendMessages(sessionId, userId, docId, docName, newMessages) {
  const sessions = loadAllSessions();
  const existing = sessions[sessionId];

  if (existing) {
    existing.messages = [...(existing.messages || []), ...newMessages];
    existing.updatedAt = new Date().toISOString();
    if (docId && !existing.docId) existing.docId = docId;
    if (docName && !existing.docName) existing.docName = docName;
  } else {
    // Create a meaningful title from the first user message
    const firstUserMsg = newMessages.find(m => m.role === 'user');
    const title = firstUserMsg
      ? firstUserMsg.content.substring(0, 60) + (firstUserMsg.content.length > 60 ? '...' : '')
      : 'New Chat';

    sessions[sessionId] = {
      sessionId,
      userId: userId || 'guest',
      docId: docId || null,
      docName: docName || null,
      title,
      messages: newMessages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  saveAllSessions(sessions);
  return sessions[sessionId];
}

module.exports = {
  getSession,
  saveSession,
  deleteSession,
  listSessions,
  clearAllSessions,
  appendMessages,
  loadAllSessions
};
