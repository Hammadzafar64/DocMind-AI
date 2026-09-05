const logger = require('../config/logger');

let settings = {
  provider: 'ollama',
  ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
  selectedModel: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  geminiApiKey: process.env.GEMINI_API_KEY || ''
};

function getSettings() {
  return { ...settings };
}

function updateSettings(newSettings) {
  if (newSettings.provider) settings.provider = newSettings.provider;
  if (newSettings.ollamaHost) settings.ollamaHost = newSettings.ollamaHost;
  if (newSettings.selectedModel) settings.selectedModel = newSettings.selectedModel;
  if (newSettings.geminiApiKey !== undefined && newSettings.geminiApiKey !== '********') {
    settings.geminiApiKey = newSettings.geminiApiKey;
  }
  return getSettings();
}

/** Check Ollama Health & fetch installed models */
async function checkOllamaStatus() {
  try {
    const res = await fetch(`${settings.ollamaHost}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return { online: false, models: [] };

    const data = await res.json();
    const models = (data.models || []).map(m => m.name);

    let activeModel = settings.selectedModel;
    if (models.includes('llama3.2:3b') && (!activeModel || !models.includes(activeModel))) {
      activeModel = 'llama3.2:3b';
      settings.selectedModel = 'llama3.2:3b';
    } else if (models.length > 0 && !models.includes(activeModel)) {
      activeModel = models[0];
      settings.selectedModel = models[0];
    }

    return {
      online: true,
      models,
      activeModel: activeModel || 'llama3.2:3b'
    };
  } catch (err) {
    return { online: false, models: [], error: err.message };
  }
}

/** Generate text response using Ollama */
async function generateResponse(prompt, systemPrompt = '') {
  const url = `${settings.ollamaHost}/api/generate`;
  const body = {
    model: settings.selectedModel || 'llama3.2:3b',
    prompt: prompt,
    system: systemPrompt,
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 200
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Ollama API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.response ? data.response.trim() : '';
}

/** Generate vector embedding via Ollama API */
async function generateEmbedding(text) {
  try {
    const url = `${settings.ollamaHost}/api/embeddings`;
    const body = {
      model: 'nomic-embed-text:latest',
      prompt: text
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.embedding && Array.isArray(data.embedding)) {
        return data.embedding;
      }
    }
  } catch (err) {
    // Non-fatal, fallback to local vectorizer
  }
  return null;
}

module.exports = {
  getSettings,
  updateSettings,
  checkOllamaStatus,
  generateResponse,
  generateEmbedding
};
