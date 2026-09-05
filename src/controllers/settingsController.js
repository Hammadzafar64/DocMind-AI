const ollamaService = require('../services/ollamaService');

async function getAIStatus(req, res, next) {
  try {
    const settings = ollamaService.getSettings();
    const ollama = await ollamaService.checkOllamaStatus();
    let currentProvider = settings.provider;

    if (currentProvider === 'ollama' && !ollama.online) {
      if (settings.geminiApiKey) {
        currentProvider = 'gemini';
      } else {
        currentProvider = 'local';
      }
    }

    res.json({
      success: true,
      provider: currentProvider,
      configuredProvider: settings.provider,
      ollamaOnline: ollama.online,
      selectedModel: settings.selectedModel || ollama.activeModel || 'llama3.2:3b',
      availableModels: ollama.models || [],
      geminiConfigured: !!settings.geminiApiKey
    });
  } catch (err) {
    next(err);
  }
}

async function getSettings(req, res, next) {
  try {
    const settings = ollamaService.getSettings();
    const ollama = await ollamaService.checkOllamaStatus();

    res.json({
      success: true,
      settings: {
        provider: settings.provider,
        ollamaHost: settings.ollamaHost,
        selectedModel: settings.selectedModel,
        geminiApiKey: settings.geminiApiKey ? '********' : ''
      },
      ollamaStatus: ollama
    });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { provider, ollamaHost, selectedModel, geminiApiKey } = req.body;
    const updated = ollamaService.updateSettings({ provider, ollamaHost, selectedModel, geminiApiKey });
    const ollama = await ollamaService.checkOllamaStatus();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        provider: updated.provider,
        ollamaHost: updated.ollamaHost,
        selectedModel: updated.selectedModel,
        geminiConfigured: !!updated.geminiApiKey
      },
      ollamaStatus: ollama
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAIStatus,
  getSettings,
  updateSettings
};
