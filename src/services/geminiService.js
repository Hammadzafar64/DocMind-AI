const { getSettings } = require('./ollamaService');

async function generateGeminiResponse(prompt, systemPrompt = '') {
  const settings = getSettings();
  if (!settings.geminiApiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`;
  const contents = [
    {
      role: 'user',
      parts: [{ text: (systemPrompt ? systemPrompt + '\n\n' : '') + prompt }]
    }
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini API returned status ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini API.');
  return text.trim();
}

module.exports = { generateGeminiResponse };
