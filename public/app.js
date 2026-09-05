document.addEventListener('DOMContentLoaded', () => {

  // ── Auto-Unregister Old Service Worker & Clear Stale Cache ────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then(names => {
      for (let name of names) caches.delete(name);
    });
  }

  // ── STATE ──────────────────────────────────────────────────────────────────
  const savedSessionId = localStorage.getItem('docmind_active_session');
  const state = {
    activeDocId: null,
    activeDocName: null,
    documents: [],
    historySessions: [],
    aiStatus: { online: false, provider: 'ollama', model: 'llama3.2:3b', models: [] },
    activeTab: 'tab-qa',
    summaryMode: 'bullets',
    isTyping: false,
    token: localStorage.getItem('docmind_token') || null,
    currentUser: null,
    sessionId: savedSessionId || ('session_' + Math.floor(Math.random() * 1000000))
  };
  localStorage.setItem('docmind_active_session', state.sessionId);

  // ── DOM ELEMENTS ──────────────────────────────────────────────────────────
  // Sidebar & Layout
  const geminiSidebar   = document.getElementById('geminiSidebar');
  const sidebarToggleBtn= document.getElementById('sidebarToggleBtn');
  const mobileMenuBtn   = document.getElementById('mobileMenuBtn');
  const newChatBtn      = document.getElementById('newChatBtn');

  // Topbar
  const topModelName    = document.getElementById('topModelName');
  const topbarAvatarBtn = document.getElementById('topbarAvatarBtn');
  const userAuthBtn     = document.getElementById('userAuthBtn');
  const userNameText    = document.getElementById('userNameText');
  const welcomeUserName = document.getElementById('welcomeUserName');
  const activeDocBadge  = document.getElementById('activeDocBadge');
  const activeDocName   = document.getElementById('activeDocName');
  const clearActiveDocBtn = document.getElementById('clearActiveDocBtn');
  const aiStatusBtn     = document.getElementById('aiStatusBtn');
  const aiStatusText    = document.getElementById('aiStatusText');
  const openSettingsBtn = document.getElementById('openSettingsBtn');

  // Sidebar Upload & List
  const dropzone        = document.getElementById('dropzone');
  const fileInput       = document.getElementById('fileInput');
  const promptAttachBtn = document.getElementById('promptAttachBtn');
  const uploadAlert     = document.getElementById('uploadAlert');
  const uploadProgressContainer = document.getElementById('uploadProgressContainer');
  const uploadProgressBar       = document.getElementById('uploadProgressBar');
  const docsList        = document.getElementById('docsList');
  const docsCountBadge  = document.getElementById('docsCountBadge');
  const viewTextBtn     = document.getElementById('viewTextBtn');

  // Tabs
  const navTabBtns      = document.querySelectorAll('.nav-tab-pill');
  const tabPanes        = document.querySelectorAll('.tab-pane');

  // Q&A Tab
  const welcomeScreen   = document.getElementById('welcomeScreen');
  const messagesStream  = document.getElementById('messagesStream');
  const chatInput       = document.getElementById('chatInput');
  const sendBtn         = document.getElementById('sendBtn');
  const clearChatBtn    = document.getElementById('clearChatBtn');
  const exampleChips    = document.querySelectorAll('.chip-btn');

  // Summarizer Tab
  const modeCards          = document.querySelectorAll('.gemini-mode-card');
  const sumSourceRadios    = document.querySelectorAll('input[name="sumSource"]');
  const sumActiveDocName   = document.getElementById('sumActiveDocName');
  const customTextBox      = document.getElementById('customTextBox');
  const customTextInput    = document.getElementById('customTextInput');
  const generateSummaryBtn = document.getElementById('generateSummaryBtn');
  const summaryOutputCard  = document.getElementById('summaryOutputCard');
  const summaryOutputBody  = document.getElementById('summaryOutputBody');
  const summaryEngineBadge = document.getElementById('summaryEngineBadge');
  const copySummaryBtn     = document.getElementById('copySummaryBtn');

  // Auth Modal
  const authModal        = document.getElementById('authModal');
  const closeAuthBtn     = document.getElementById('closeAuthBtn');
  const tabLoginBtn      = document.getElementById('tabLoginBtn');
  const tabRegisterBtn   = document.getElementById('tabRegisterBtn');
  const loginForm        = document.getElementById('loginForm');
  const registerForm     = document.getElementById('registerForm');
  const loginEmail       = document.getElementById('loginEmail');
  const loginPassword    = document.getElementById('loginPassword');
  const loginError       = document.getElementById('loginError');
  const regName          = document.getElementById('regName');
  const regEmail         = document.getElementById('regEmail');
  const regPassword      = document.getElementById('regPassword');
  const regError         = document.getElementById('regError');
  const authProfileBox   = document.getElementById('authProfileBox');
  const profileEmail     = document.getElementById('profileEmail');
  const logoutBtn        = document.getElementById('logoutBtn');

  // Settings Modal
  const settingsModal     = document.getElementById('settingsModal');
  const closeSettingsBtn  = document.getElementById('closeSettingsBtn');
  const providerSelect    = document.getElementById('providerSelect');
  const ollamaOptions     = document.getElementById('ollamaOptions');
  const geminiOptions     = document.getElementById('geminiOptions');
  const ollamaHostInput   = document.getElementById('ollamaHostInput');
  const ollamaModelSelect = document.getElementById('ollamaModelSelect');
  const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
  const settingsStatusCard= document.getElementById('settingsStatusCard');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const saveSettingsBtn   = document.getElementById('saveSettingsBtn');

  // Text Viewer Modal
  const textViewerModal     = document.getElementById('textViewerModal');
  const closeTextViewerBtn  = document.getElementById('closeTextViewerBtn');
  const textViewerTitle     = document.getElementById('textViewerTitle');
  const textViewerStats     = document.getElementById('textViewerStats');
  const textViewerContent   = document.getElementById('textViewerContent');
  const copyExtractedTextBtn= document.getElementById('copyExtractedTextBtn');

  // History Elements & Modal
  const historySessionsList    = document.getElementById('historySessionsList');
  const historyCountBadge      = document.getElementById('historyCountBadge');
  const historyEmptyState      = document.getElementById('historyEmptyState');
  const openHistoryManagerBtn  = document.getElementById('openHistoryManagerBtn');
  const openHistoryManagerBtn2 = document.getElementById('openHistoryManagerBtn2');
  const historyManagerModal    = document.getElementById('historyManagerModal');
  const closeHistoryManagerBtn = document.getElementById('closeHistoryManagerBtn');
  const historySearchInput     = document.getElementById('historySearchInput');
  const historyTotalBadge      = document.getElementById('historyTotalBadge');
  const clearAllHistoryBtn     = document.getElementById('clearAllHistoryBtn');
  const historyManagerGrid     = document.getElementById('historyManagerGrid');

  // Helper for Authenticated Fetch
  async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (state.token) {
      options.headers['Authorization'] = `Bearer ${state.token}`;
    }
    return fetch(url, options);
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  checkUserAuth();
  fetchAIStatus();
  fetchDocuments();
  fetchHistorySessions();
  fetchChatHistory();

  setInterval(fetchAIStatus, 15000);

  // ── SIDEBAR CONTROLS ───────────────────────────────────────────────────────
  if (sidebarToggleBtn && geminiSidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      geminiSidebar.classList.toggle('collapsed');
    });
  }

  if (mobileMenuBtn && geminiSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      geminiSidebar.classList.toggle('mobile-open');
    });
  }

  // Click outside to close mobile drawer
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && geminiSidebar && geminiSidebar.classList.contains('mobile-open')) {
      if (!geminiSidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        geminiSidebar.classList.remove('mobile-open');
      }
    }
  });

  // "+ New Chat" Button
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      startNewChat();
    });
  }

  function startNewChat() {
    state.sessionId = 'session_' + Math.floor(Math.random() * 1000000);
    localStorage.setItem('docmind_active_session', state.sessionId);
    messagesStream.innerHTML = '';
    messagesStream.classList.add('hidden');
    welcomeScreen.classList.remove('hidden');
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;
    renderHistorySidebar();
    if (window.innerWidth <= 768 && geminiSidebar) geminiSidebar.classList.remove('mobile-open');
  }

  // Attach button in prompt bar
  if (promptAttachBtn && fileInput) {
    promptAttachBtn.addEventListener('click', () => fileInput.click());
  }

  // Clear Active Document
  if (clearActiveDocBtn) {
    clearActiveDocBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearActiveDocument();
    });
  }

  // ── AUTH MANAGEMENT ───────────────────────────────────────────────────────
  async function checkUserAuth() {
    if (!state.token) {
      setGuestUserUI();
      return;
    }

    try {
      const res = await authFetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.user) {
        state.currentUser = data.user;
        const name = data.user.name || data.user.email.split('@')[0];
        userNameText.textContent = name;
        if (welcomeUserName) welcomeUserName.textContent = name;
      } else {
        logoutUser();
      }
    } catch (e) {
      setGuestUserUI();
    }
  }

  function setGuestUserUI() {
    userNameText.textContent = 'Guest User';
    if (welcomeUserName) welcomeUserName.textContent = 'Friend';
  }

  function openAuthModal() {
    authModal.classList.remove('hidden');
    if (state.currentUser) {
      loginForm.classList.add('hidden');
      registerForm.classList.add('hidden');
      authProfileBox.classList.remove('hidden');
      profileEmail.textContent = state.currentUser.email;
    } else {
      authProfileBox.classList.add('hidden');
      showLoginForm();
    }
  }

  userAuthBtn.addEventListener('click', openAuthModal);
  if (topbarAvatarBtn) topbarAvatarBtn.addEventListener('click', openAuthModal);

  closeAuthBtn.addEventListener('click', () => authModal.classList.add('hidden'));

  tabLoginBtn.addEventListener('click', showLoginForm);
  tabRegisterBtn.addEventListener('click', showRegisterForm);

  function showLoginForm() {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  }

  function showRegisterForm() {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        state.token = data.token;
        state.currentUser = data.user;
        localStorage.setItem('docmind_token', data.token);
        const name = data.user.name || data.user.email.split('@')[0];
        userNameText.textContent = name;
        if (welcomeUserName) welcomeUserName.textContent = name;
        authModal.classList.add('hidden');
        await fetchHistorySessions();
      } else {
        loginError.textContent = data.error || 'Login failed';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      loginError.textContent = 'Network error: ' + err.message;
      loginError.classList.remove('hidden');
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regError.classList.add('hidden');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName.value, email: regEmail.value, password: regPassword.value })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        state.token = data.token;
        state.currentUser = data.user;
        localStorage.setItem('docmind_token', data.token);
        userNameText.textContent = data.user.name;
        if (welcomeUserName) welcomeUserName.textContent = data.user.name;
        authModal.classList.add('hidden');
        await fetchHistorySessions();
      } else {
        regError.textContent = data.error || 'Registration failed';
        regError.classList.remove('hidden');
      }
    } catch (err) {
      regError.textContent = 'Network error: ' + err.message;
      regError.classList.remove('hidden');
    }
  });

  logoutBtn.addEventListener('click', logoutUser);

  async function logoutUser() {
    state.token = null;
    state.currentUser = null;
    localStorage.removeItem('docmind_token');
    setGuestUserUI();
    authProfileBox.classList.add('hidden');
    showLoginForm();
    authModal.classList.add('hidden');
    await fetchHistorySessions();
  }

  // ── TAB SWITCHING ──────────────────────────────────────────────────────────
  navTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      navTabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(target);
      if (pane) pane.classList.add('active');
      state.activeTab = target;
    });
  });

  // ── AI STATUS & SETTINGS ───────────────────────────────────────────────────
  async function fetchAIStatus() {
    try {
      const res = await authFetch('/api/ai/status');
      const data = await res.json();

      if (data.success) {
        state.aiStatus = data;
        updateAIStatusUI();
      }
    } catch (err) {
      aiStatusBtn.className = 'sidebar-ai-pill offline';
      aiStatusText.textContent = 'AI Offline';
      if (topModelName) topModelName.textContent = 'Local Engine';
    }
  }

  function updateAIStatusUI() {
    const { provider, ollamaOnline, selectedModel } = state.aiStatus;

    if (provider === 'ollama' && ollamaOnline) {
      aiStatusBtn.className = 'sidebar-ai-pill';
      aiStatusText.textContent = `Ollama (${selectedModel || 'llama3.2:3b'})`;
      if (topModelName) topModelName.textContent = selectedModel || 'llama3.2:3b';
    } else if (provider === 'gemini') {
      aiStatusBtn.className = 'sidebar-ai-pill';
      aiStatusText.textContent = 'Gemini 1.5 Flash';
      if (topModelName) topModelName.textContent = 'Gemini 1.5 Flash';
    } else {
      aiStatusBtn.className = 'sidebar-ai-pill offline';
      aiStatusText.textContent = 'Local Extractive NLP';
      if (topModelName) topModelName.textContent = 'Local NLP';
    }
  }

  aiStatusBtn.addEventListener('click', openSettings);
  openSettingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

  async function openSettings() {
    settingsModal.classList.remove('hidden');
    settingsStatusCard.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Checking connection status...';

    try {
      const res = await authFetch('/api/settings');
      const data = await res.json();

      if (data.success) {
        const { settings, ollamaStatus } = data;
        providerSelect.value = settings.provider || 'ollama';
        ollamaHostInput.value = settings.ollamaHost || 'http://localhost:11434';
        
        ollamaModelSelect.innerHTML = '';
        if (ollamaStatus.models && ollamaStatus.models.length > 0) {
          ollamaStatus.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = `${m}${m === 'llama3.2:3b' ? ' (Installed)' : ''}`;
            if (m === settings.selectedModel) opt.selected = true;
            ollamaModelSelect.appendChild(opt);
          });
        } else {
          const opt = document.createElement('option');
          opt.value = 'llama3.2:3b';
          opt.textContent = 'llama3.2:3b (Target Model)';
          ollamaModelSelect.appendChild(opt);
        }

        geminiApiKeyInput.value = settings.geminiApiKey || '';
        toggleProviderOptions();

        if (ollamaStatus.online) {
          settingsStatusCard.className = 'settings-status-box';
          settingsStatusCard.innerHTML = `🟢 <strong>Connected to Ollama</strong> on ${settings.ollamaHost}. Found ${ollamaStatus.models.length} model(s).`;
        } else {
          settingsStatusCard.className = 'settings-status-box';
          settingsStatusCard.innerHTML = `⚠️ <strong>Ollama is Offline</strong> on ${settings.ollamaHost}. Falling back to Local Extractive Engine.`;
        }
      }
    } catch (err) {
      settingsStatusCard.innerHTML = '❌ Failed to load settings: ' + err.message;
    }
  }

  providerSelect.addEventListener('change', toggleProviderOptions);

  function toggleProviderOptions() {
    const provider = providerSelect.value;
    if (provider === 'ollama') {
      ollamaOptions.classList.remove('hidden');
      geminiOptions.classList.add('hidden');
    } else if (provider === 'gemini') {
      ollamaOptions.classList.add('hidden');
      geminiOptions.classList.remove('hidden');
    } else {
      ollamaOptions.classList.add('hidden');
      geminiOptions.classList.add('hidden');
    }
  }

  testConnectionBtn.addEventListener('click', async () => {
    settingsStatusCard.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Testing connection...';
    try {
      const res = await authFetch('/api/ai/status');
      const data = await res.json();

      if (data.ollamaOnline) {
        settingsStatusCard.innerHTML = `🟢 <strong>Ollama Online!</strong> Detected models: ${data.availableModels.join(', ')}`;
      } else {
        settingsStatusCard.innerHTML = `⚠️ Ollama server is offline or unreachable at ${ollamaHostInput.value}.`;
      }
    } catch (err) {
      settingsStatusCard.innerHTML = '❌ Error testing connection: ' + err.message;
    }
  });

  saveSettingsBtn.addEventListener('click', async () => {
    try {
      const body = {
        provider: providerSelect.value,
        ollamaHost: ollamaHostInput.value,
        selectedModel: ollamaModelSelect.value,
        geminiApiKey: geminiApiKeyInput.value
      };

      const res = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        settingsModal.classList.add('hidden');
        fetchAIStatus();
      }
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    }
  });

  // ── FILE UPLOAD & DOCUMENTS LIST ──────────────────────────────────────────
  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      fileInput.value = '';
      handleFileUpload(file);
    }
  });

  async function handleFileUpload(file) {
    showUploadAlert(`Uploading "${file.name}"…`, 'info');
    uploadProgressContainer.classList.remove('hidden');
    uploadProgressBar.style.width = '35%';

    const formData = new FormData();
    formData.append('file', file);

    try {
      uploadProgressBar.style.width = '75%';
      const res = await authFetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      uploadProgressBar.style.width = '100%';
      setTimeout(() => uploadProgressContainer.classList.add('hidden'), 800);

      if (!res.ok || !data.success) {
        showUploadAlert(`❌ Upload failed: ${data.error || 'Server error during upload'}`, 'error');
        return;
      }

      showUploadAlert(`✅ "${data.name}" indexed successfully!`, 'success');
      setTimeout(hideUploadAlert, 3500);

      await fetchDocuments();
      setActiveDocument(data.docId || data.document.id);

    } catch (err) {
      uploadProgressContainer.classList.add('hidden');
      showUploadAlert(`❌ Server error during upload: ${err.message}`, 'error');
    }
  }

  function showUploadAlert(msg, type = 'error') {
    uploadAlert.textContent = msg;
    uploadAlert.className = `upload-alert ${type === 'success' ? 'success' : ''}`;
    uploadAlert.classList.remove('hidden');
  }

  function hideUploadAlert() {
    uploadAlert.classList.add('hidden');
  }

  async function fetchDocuments() {
    try {
      const res = await authFetch('/api/documents');
      const data = await res.json();

      if (data.success) {
        state.documents = data.documents;
        renderDocumentsList();

        if (!state.activeDocId && state.documents.length > 0) {
          setActiveDocument(state.documents[0].id);
        } else if (state.documents.length === 0) {
          clearActiveDocument();
        }
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  }

  function renderDocumentsList() {
    docsCountBadge.textContent = state.documents.length;

    if (state.documents.length === 0) {
      docsList.innerHTML = `
        <div class="docs-empty">
          <i class="fa-regular fa-folder-open"></i>
          <p>No documents uploaded yet</p>
          <span>Upload a file to start chatting</span>
        </div>`;
      viewTextBtn.disabled = true;
      return;
    }

    docsList.innerHTML = '';
    state.documents.forEach(doc => {
      const isSelected = doc.id === state.activeDocId;
      const div = document.createElement('div');
      div.className = `doc-item ${isSelected ? 'active' : ''}`;
      div.innerHTML = `
        <div class="doc-item-info">
          <i class="fa-solid ${getFileIcon(doc.name)} doc-item-icon"></i>
          <div class="doc-item-details">
            <span class="doc-item-name" title="${escHtml(doc.name)}">${escHtml(doc.name)}</span>
            <span class="doc-item-meta">${doc.wordCount ? doc.wordCount.toLocaleString() : 0} words • ${doc.formattedSize || 'N/A'}</span>
          </div>
        </div>
        <button class="doc-item-delete" data-id="${doc.id}" title="Delete document">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      `;

      div.addEventListener('click', (e) => {
        if (!e.target.closest('.doc-item-delete')) {
          setActiveDocument(doc.id);
        }
      });

      div.querySelector('.doc-item-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteDocument(doc.id);
      });

      docsList.appendChild(div);
    });

    viewTextBtn.disabled = !state.activeDocId;
  }

  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'fa-file-pdf';
    if (ext === 'docx' || ext === 'doc') return 'fa-file-word';
    if (ext === 'txt' || ext === 'md') return 'fa-file-lines';
    return 'fa-file-code';
  }

  function setActiveDocument(docId) {
    const doc = state.documents.find(d => d.id === docId || d.docId === docId);
    if (!doc) return;

    state.activeDocId = doc.id || doc.docId;
    state.activeDocName = doc.name;

    activeDocBadge.classList.add('active');
    activeDocName.textContent = doc.name;
    sumActiveDocName.textContent = doc.name;

    renderDocumentsList();
  }

  function clearActiveDocument() {
    state.activeDocId = null;
    state.activeDocName = null;
    activeDocBadge.classList.remove('active');
    activeDocName.textContent = 'No document active';
    sumActiveDocName.textContent = 'None';
    viewTextBtn.disabled = true;
    renderDocumentsList();
  }

  async function deleteDocument(docId) {
    try {
      await authFetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (state.activeDocId === docId) {
        clearActiveDocument();
      }
      await fetchDocuments();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  }

  // Extracted Text Viewer Modal
  viewTextBtn.addEventListener('click', async () => {
    if (!state.activeDocId) return;
    textViewerModal.classList.remove('hidden');
    textViewerTitle.innerHTML = `<i class="fa-regular fa-file-lines"></i> Extracted: "${escHtml(state.activeDocName)}"`;
    textViewerContent.textContent = 'Loading text...';

    try {
      const res = await authFetch(`/api/documents/${state.activeDocId}/text`);
      const data = await res.json();
      if (data.success) {
        textViewerStats.textContent = `${data.wordCount.toLocaleString()} words`;
        textViewerContent.textContent = data.text;
      }
    } catch (err) {
      textViewerContent.textContent = 'Failed to load text: ' + err.message;
    }
  });

  closeTextViewerBtn.addEventListener('click', () => textViewerModal.classList.add('hidden'));
  copyExtractedTextBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(textViewerContent.textContent);
    copyExtractedTextBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => copyExtractedTextBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Text', 2000);
  });

  // ── TAB 1: GEMINI Q&A CHAT ────────────────────────────────────────────────
  async function fetchChatHistory() {
    try {
      const res = await authFetch(`/api/chat/history?sessionId=${state.sessionId}`);
      const data = await res.json();
      if (data.success && data.messages && data.messages.length > 0) {
        welcomeScreen.classList.add('hidden');
        messagesStream.classList.remove('hidden');
        messagesStream.innerHTML = '';
        data.messages.forEach(msg => {
          if (msg.role === 'user') {
            appendUserMessage(msg.content);
          } else {
            appendBotMessage(msg.content, msg.engine, msg.sources);
          }
        });
      }
    } catch (e) {}
  }

  chatInput.addEventListener('input', () => {
    sendBtn.disabled = !chatInput.value.trim();
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendChatMessage();
    }
  });

  sendBtn.addEventListener('click', sendChatMessage);

  exampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.dataset.msg;
      chatInput.dispatchEvent(new Event('input'));
      sendChatMessage();
    });
  });

  clearChatBtn.addEventListener('click', async () => {
    await authFetch('/api/chat/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId })
    });
    messagesStream.innerHTML = '';
    messagesStream.classList.add('hidden');
    welcomeScreen.classList.remove('hidden');
    await fetchHistorySessions();
  });

  async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || state.isTyping) return;

    // Auto-activate first document if available and none selected
    if (!state.activeDocId && state.documents && state.documents.length > 0) {
      setActiveDocument(state.documents[0].id || state.documents[0].docId);
    }

    if (!state.activeDocId && (!state.documents || state.documents.length === 0)) {
      welcomeScreen.classList.add('hidden');
      messagesStream.classList.remove('hidden');
      appendUserMessage(text);
      chatInput.value = '';
      chatInput.style.height = 'auto';
      sendBtn.disabled = true;
      appendBotMessage("⚠️ Please upload a document first (via the left sidebar or the '+' button below) so I can answer your questions accurately from it.", "DocMind");
      return;
    }

    welcomeScreen.classList.add('hidden');
    messagesStream.classList.remove('hidden');

    appendUserMessage(text);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    const thinkId = showThinking();
    state.isTyping = true;

    try {
      const res = await authFetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, docId: state.activeDocId, sessionId: state.sessionId })
      });

      const data = await res.json();
      removeThinking(thinkId);
      state.isTyping = false;

      if (res.ok && data.success) {
        appendBotMessage(data.answer || data.reply, data.engine, data.sources);
        await fetchHistorySessions();
      } else {
        appendBotMessage(`❌ Error: ${data.error || 'Something went wrong.'}`, 'System Error');
      }
    } catch (err) {
      removeThinking(thinkId);
      state.isTyping = false;
      appendBotMessage(`❌ Network error: ${err.message}`, 'Network Error');
    }
  }

  function appendUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = `
      <div class="msg-bubble">${escHtml(text)}</div>
    `;
    messagesStream.appendChild(div);
    scrollToBottom();
  }

  function appendBotMessage(text, engine = '', sources = []) {
    const div = document.createElement('div');
    div.className = 'msg bot';

    const parsed = window.marked ? marked.parse(text) : escHtml(text).replace(/\n/g, '<br>');
    let engineHtml = engine ? `<span class="engine-tag"><i class="fa-solid fa-microchip"></i> ${escHtml(engine)}</span>` : '';

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
      const sourceItems = sources.map((s, i) =>
        `<div class="source-item"><strong>Source Excerpt ${i + 1}:</strong> "${escHtml(s.substring(0, 160))}…"</div>`
      ).join('');
      sourcesHtml = `
        <div class="msg-sources">
          <span><i class="fa-solid fa-quote-left"></i> Context Sources:</span>
          ${sourceItems}
        </div>`;
    }

    div.innerHTML = `
      <div class="msg-avatar" title="DocMind AI">
        <svg class="gemini-sparkle-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"/>
        </svg>
      </div>
      <div class="msg-body">
        ${engineHtml}
        <div class="msg-bubble">${parsed}</div>
        ${sourcesHtml}
        <div class="msg-actions">
          <button class="btn-copy-msg"><i class="fa-regular fa-copy"></i> Copy response</button>
        </div>
      </div>
    `;

    div.querySelector('.btn-copy-msg').addEventListener('click', function() {
      navigator.clipboard.writeText(text);
      this.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
      setTimeout(() => this.innerHTML = '<i class="fa-regular fa-copy"></i> Copy response', 2000);
    });

    messagesStream.appendChild(div);
    scrollToBottom();
  }

  function showThinking() {
    const id = 'think_' + Date.now();
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.id = id;
    div.innerHTML = `
      <div class="msg-avatar">
        <svg class="gemini-sparkle-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"/>
        </svg>
      </div>
      <div class="msg-body">
        <div class="typing-wave-container">
          <div class="gemini-wave-bar"></div>
          <span>DocMind is retrieving context &amp; thinking...</span>
        </div>
      </div>
    `;
    messagesStream.appendChild(div);
    scrollToBottom();
    return id;
  }

  function removeThinking(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function scrollToBottom() {
    messagesStream.scrollTop = messagesStream.scrollHeight;
  }

  // ── TAB 2: TEXT SUMMARIZER ────────────────────────────────────────────────
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.summaryMode = card.dataset.mode;
    });
  });

  sumSourceRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'customText') {
        customTextBox.classList.remove('hidden');
      } else {
        customTextBox.classList.add('hidden');
      }
    });
  });

  generateSummaryBtn.addEventListener('click', async () => {
    const source = document.querySelector('input[name="sumSource"]:checked').value;
    let payload = { mode: state.summaryMode };

    if (source === 'customText') {
      const text = customTextInput.value.trim();
      if (!text || text.length < 20) {
        alert('Please paste at least 20 characters of text to summarize.');
        return;
      }
      payload.text = text;
    } else {
      if (!state.activeDocId) {
        alert('No document selected. Please upload or select a document first.');
        return;
      }
      payload.docId = state.activeDocId;
    }

    generateSummaryBtn.disabled = true;
    generateSummaryBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generating Summary…';
    summaryOutputCard.classList.add('hidden');

    try {
      const res = await authFetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      generateSummaryBtn.disabled = false;
      generateSummaryBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Summary';

      if (res.ok && data.success) {
        summaryOutputCard.classList.remove('hidden');
        summaryEngineBadge.textContent = data.engine || 'Ollama';
        summaryOutputBody.innerHTML = window.marked ? marked.parse(data.summary) : escHtml(data.summary);
      } else {
        alert('Error: ' + (data.error || 'Failed to generate summary.'));
      }
    } catch (err) {
      generateSummaryBtn.disabled = false;
      generateSummaryBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Summary';
      alert('Network error: ' + err.message);
    }
  });

  copySummaryBtn.addEventListener('click', () => {
    const text = summaryOutputBody.innerText;
    navigator.clipboard.writeText(text);
    copySummaryBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => copySummaryBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy', 2000);
  });

  // ── CHAT HISTORY SESSIONS MANAGEMENT ───────────────────────────────────────
  async function fetchHistorySessions() {
    try {
      const res = await authFetch('/api/history/sessions');
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        state.historySessions = data.sessions;
        if (historyCountBadge) historyCountBadge.textContent = state.historySessions.length;
        if (historyTotalBadge) historyTotalBadge.textContent = `${state.historySessions.length} session${state.historySessions.length === 1 ? '' : 's'}`;
        renderHistorySidebar();
        if (historyManagerModal && !historyManagerModal.classList.contains('hidden')) {
          renderHistoryModalGrid();
        }
      }
    } catch (err) {
      console.error('Failed to fetch history sessions:', err);
    }
  }

  function renderHistorySidebar() {
    if (!historySessionsList) return;

    if (!state.historySessions || state.historySessions.length === 0) {
      historySessionsList.innerHTML = `
        <div class="docs-empty" id="historyEmptyState">
          <i class="fa-regular fa-comments"></i>
          <p>No history yet</p>
          <span>Your chats will appear here</span>
        </div>`;
      return;
    }

    historySessionsList.innerHTML = '';
    state.historySessions.forEach(session => {
      const isActive = session.sessionId === state.sessionId;
      const item = document.createElement('div');
      item.className = `history-session-item ${isActive ? 'active' : ''}`;
      item.dataset.sessionId = session.sessionId;

      const timeAgo = formatTimeAgo(session.updatedAt || session.createdAt);
      const docBadge = session.docName ? `<span class="history-doc-tag" title="${escHtml(session.docName)}"><i class="fa-solid fa-file"></i> ${escHtml(truncate(session.docName, 18))}</span>` : '';

      item.innerHTML = `
        <div class="history-session-info">
          <i class="fa-regular fa-message history-session-icon"></i>
          <div class="history-session-details">
            <span class="history-session-title" title="${escHtml(session.title || 'Chat Session')}">${escHtml(session.title || 'Chat Session')}</span>
            <div class="history-session-meta">
              <span>${timeAgo}</span>
              ${docBadge}
            </div>
          </div>
        </div>
        <button class="history-item-delete" title="Delete conversation" data-id="${session.sessionId}">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      `;

      item.addEventListener('click', (e) => {
        if (!e.target.closest('.history-item-delete')) {
          loadHistorySession(session.sessionId);
        }
      });

      const delBtn = item.querySelector('.history-item-delete');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await deleteHistorySession(session.sessionId);
        });
      }

      historySessionsList.appendChild(item);
    });
  }

  async function loadHistorySession(sessionId) {
    if (!sessionId) return;
    state.sessionId = sessionId;
    localStorage.setItem('docmind_active_session', sessionId);

    // Switch to Q&A tab if in another tab
    const qaTabBtn = document.querySelector('.nav-tab-pill[data-tab="tab-qa"]');
    if (qaTabBtn && !qaTabBtn.classList.contains('active')) {
      qaTabBtn.click();
    }

    renderHistorySidebar();

    // Close mobile sidebar if open
    if (window.innerWidth <= 768 && geminiSidebar) {
      geminiSidebar.classList.remove('mobile-open');
    }

    // Close History Modal if open
    if (historyManagerModal) {
      historyManagerModal.classList.add('hidden');
    }

    // Fetch and render messages
    try {
      welcomeScreen.classList.add('hidden');
      messagesStream.classList.remove('hidden');
      messagesStream.innerHTML = '<div class="typing-wave-container" style="padding:20px 0;"><div class="gemini-wave-bar"></div><span>Loading conversation…</span></div>';

      const res = await authFetch(`/api/history/sessions/${sessionId}`);
      const data = await res.json();

      if (data.success && data.session) {
        const session = data.session;
        messagesStream.innerHTML = '';

        // Auto-select session document if available
        if (session.docId) {
          setActiveDocument(session.docId);
        }

        if (session.messages && session.messages.length > 0) {
          session.messages.forEach(msg => {
            if (msg.role === 'user') {
              appendUserMessage(msg.content);
            } else {
              appendBotMessage(msg.content, msg.engine, msg.sources);
            }
          });
        } else {
          welcomeScreen.classList.remove('hidden');
          messagesStream.classList.add('hidden');
        }
      } else {
        messagesStream.innerHTML = '';
        welcomeScreen.classList.remove('hidden');
        messagesStream.classList.add('hidden');
      }
    } catch (err) {
      console.error('Error loading history session:', err);
      messagesStream.innerHTML = '';
      welcomeScreen.classList.remove('hidden');
      messagesStream.classList.add('hidden');
    }
  }

  async function deleteHistorySession(sessionId) {
    try {
      const res = await authFetch(`/api/history/sessions/${sessionId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (state.sessionId === sessionId) {
          startNewChat();
        }
        await fetchHistorySessions();
      }
    } catch (err) {
      console.error('Failed to delete history session:', err);
    }
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '…' : str;
  }

  // ── HISTORY MANAGER MODAL ──────────────────────────────────────────────────
  function openHistoryManager() {
    if (!historyManagerModal) return;
    historyManagerModal.classList.remove('hidden');
    if (historySearchInput) {
      historySearchInput.value = '';
      historySearchInput.focus();
    }
    fetchHistorySessions();
  }

  function closeHistoryManager() {
    if (historyManagerModal) historyManagerModal.classList.add('hidden');
  }

  if (openHistoryManagerBtn) openHistoryManagerBtn.addEventListener('click', openHistoryManager);
  if (openHistoryManagerBtn2) openHistoryManagerBtn2.addEventListener('click', openHistoryManager);
  if (closeHistoryManagerBtn) closeHistoryManagerBtn.addEventListener('click', closeHistoryManager);

  // Close modal when clicking backdrop
  if (historyManagerModal) {
    historyManagerModal.addEventListener('click', (e) => {
      if (e.target === historyManagerModal) closeHistoryManager();
    });
  }

  // Search filter
  if (historySearchInput) {
    historySearchInput.addEventListener('input', () => {
      const q = historySearchInput.value.toLowerCase().trim();
      const filtered = state.historySessions.filter(s =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.docName && s.docName.toLowerCase().includes(q))
      );
      renderHistoryModalGrid(filtered);
    });
  }

  function renderHistoryModalGrid(sessions = state.historySessions) {
    if (!historyManagerGrid) return;

    if (!sessions || sessions.length === 0) {
      historyManagerGrid.innerHTML = `
        <div class="history-empty-state">
          <i class="fa-regular fa-comments" style="font-size:2.5rem;opacity:0.3;margin-bottom:12px;"></i>
          <p>No chat sessions found.</p>
          <span>${historySearchInput && historySearchInput.value ? 'Try a different search keyword.' : 'Start a conversation to see it here.'}</span>
        </div>`;
      return;
    }

    historyManagerGrid.innerHTML = '';
    sessions.forEach(s => {
      const card = document.createElement('div');
      card.className = `history-card ${s.sessionId === state.sessionId ? 'active' : ''}`;
      const timeAgo = formatTimeAgo(s.updatedAt || s.createdAt);

      card.innerHTML = `
        <div class="history-card-header">
          <h4 class="history-card-title">${escHtml(s.title || 'Untitled Conversation')}</h4>
          <span class="history-card-count">${s.messageCount || 0} msgs</span>
        </div>
        <div class="history-card-meta">
          <span><i class="fa-regular fa-clock"></i> ${timeAgo}</span>
          ${s.docName ? `<span class="history-doc-pill"><i class="fa-solid fa-file"></i> ${escHtml(truncate(s.docName, 22))}</span>` : ''}
        </div>
        <div class="history-card-actions">
          <button class="btn-card-open" data-id="${s.sessionId}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Chat
          </button>
          <button class="btn-card-delete" data-id="${s.sessionId}" title="Delete session">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      `;

      card.querySelector('.btn-card-open').addEventListener('click', () => {
        loadHistorySession(s.sessionId);
      });

      card.querySelector('.btn-card-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteHistorySession(s.sessionId);
      });

      historyManagerGrid.appendChild(card);
    });
  }

  // Clear All History
  if (clearAllHistoryBtn) {
    clearAllHistoryBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete all chat history? This cannot be undone.')) return;
      try {
        const res = await authFetch('/api/history/all', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          startNewChat();
          await fetchHistorySessions();
        }
      } catch (err) {
        alert('Failed to clear history: ' + err.message);
      }
    });
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (window.marked) marked.setOptions({ breaks: true });

});
