// Global Application State
const state = {
  token: localStorage.getItem('token') || '',
  email: localStorage.getItem('email') || '',
  activeConversationId: '',
  activeQuiz: null,
  currentQuestionIndex: 0,
  selectedOptionIndex: null,
  quizAnswers: [],
  sseSource: null,
  selectedSubject: 'General',
  selectedFile: null
};

// Elements Selectors
const el = {
  authScreen: document.getElementById('auth-screen'),
  appWorkspace: document.getElementById('app-workspace'),
  userProfile: document.getElementById('user-profile'),
  profileEmail: document.getElementById('profile-email'),
  btnLogout: document.getElementById('btn-logout'),
  
  tabLogin: document.getElementById('tab-login'),
  tabRegister: document.getElementById('tab-register'),
  formLogin: document.getElementById('form-login'),
  formRegister: document.getElementById('form-register'),
  authError: document.getElementById('auth-error'),
  
  navChat: document.getElementById('nav-chat'),
  navRag: document.getElementById('nav-rag'),
  navQuiz: document.getElementById('nav-quiz'),
  
  secChat: document.getElementById('section-chat'),
  secRag: document.getElementById('section-rag'),
  secQuiz: document.getElementById('section-quiz'),
  
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  chatMessages: document.getElementById('chat-messages'),
  checkboxRag: document.getElementById('checkbox-rag'),
  selectSubject: document.getElementById('select-subject'),
  
  ragForm: document.getElementById('rag-upload-form'),
  ragTitle: document.getElementById('rag-title'),
  ragContent: document.getElementById('rag-content'),
  ragSuccessMsg: document.getElementById('rag-success-msg'),
  ragSuccessMsgText: document.getElementById('rag-success-msg-text'),
  documentsList: document.getElementById('documents-list'),
  
  ragTabFile: document.getElementById('rag-tab-file'),
  ragTabText: document.getElementById('rag-tab-text'),
  ragPanelFile: document.getElementById('rag-panel-file'),
  ragPanelText: document.getElementById('rag-panel-text'),
  ragFileForm: document.getElementById('rag-file-form'),
  dragDropZone: document.getElementById('drag-drop-zone'),
  btnBrowseFile: document.getElementById('btn-browse-file'),
  ragFileInput: document.getElementById('rag-file-input'),
  selectedFileInfo: document.getElementById('selected-file-info'),
  selectedFileName: document.getElementById('selected-file-name'),
  selectedFileSize: document.getElementById('selected-file-size'),
  btnClearFile: document.getElementById('btn-clear-file'),
  btnFileSubmit: document.getElementById('btn-file-submit'),
  
  quizSetupCard: document.getElementById('quiz-setup-card'),
  quizForm: document.getElementById('quiz-generation-form'),
  quizTopic: document.getElementById('quiz-topic'),
  quizCount: document.getElementById('quiz-count'),
  quizSheetCard: document.getElementById('quiz-sheet-card'),
  quizSheetTitle: document.getElementById('quiz-sheet-title'),
  quizProgressText: document.getElementById('quiz-progress-text'),
  quizQuestionContainer: document.getElementById('quiz-question-container'),
  quizNextBtn: document.getElementById('quiz-next-btn'),
  quizReportCard: document.getElementById('quiz-report-card'),
  reportScore: document.getElementById('report-score'),
  reportTotal: document.getElementById('report-total'),
  reportPercentage: document.getElementById('report-percentage'),
  reportFeedbackList: document.getElementById('report-feedback-list'),
  btnQuizRestart: document.getElementById('btn-quiz-restart'),
  quizHistoryList: document.getElementById('quiz-history-list')
};

// Initialize App
function init() {
  lucide.createIcons();
  bindEvents();
  
  if (state.token) {
    showWorkspace();
  } else {
    showAuthScreen();
  }
}

// Show/Hide Screens
function showAuthScreen() {
  el.authScreen.classList.remove('hidden');
  el.appWorkspace.classList.add('hidden');
  el.userProfile.classList.add('hidden');
}

function showWorkspace() {
  el.authScreen.classList.add('hidden');
  el.appWorkspace.classList.remove('hidden');
  el.userProfile.classList.remove('hidden');
  el.profileEmail.textContent = state.email;
  
  // Load current section data
  loadRAGDocuments();
  loadQuizHistory();
}

// Event Bindings
function bindEvents() {
  // Authentication Forms
  el.tabLogin.addEventListener('click', () => toggleAuthTabs('login'));
  el.tabRegister.addEventListener('click', () => toggleAuthTabs('register'));
  el.formLogin.addEventListener('submit', handleLogin);
  el.formRegister.addEventListener('submit', handleRegister);
  el.btnLogout.addEventListener('click', handleLogout);
  
  // Navigation tabs
  el.navChat.addEventListener('click', () => switchSection('chat'));
  el.navRag.addEventListener('click', () => switchSection('rag'));
  el.navQuiz.addEventListener('click', () => switchSection('quiz'));
  
  // Chat Input
  el.chatForm.addEventListener('submit', handleChatSubmit);
  
  // Subject Selection
  el.selectSubject.addEventListener('change', () => {
    state.selectedSubject = el.selectSubject.value;
    state.activeConversationId = '';
    el.chatMessages.innerHTML = `
      <div class="message system-msg">
        <div class="msg-avatar">
          <i data-lucide="sparkles"></i>
        </div>
        <div class="msg-body">
          Subject changed to <strong>${el.selectSubject.options[el.selectSubject.selectedIndex].text}</strong>. I will now tutor you accordingly. Ask me anything!
        </div>
      </div>
    `;
    lucide.createIcons();
  });
  
  // RAG Form (text notes)
  el.ragForm.addEventListener('submit', handleRagSubmit);

  // RAG Tabs
  el.ragTabFile.addEventListener('click', () => switchRagTab('file'));
  el.ragTabText.addEventListener('click', () => switchRagTab('text'));

  // RAG File Upload & Drag/Drop
  el.btnBrowseFile.addEventListener('click', () => el.ragFileInput.click());
  el.ragFileInput.addEventListener('change', handleFileSelect);
  
  el.dragDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dragDropZone.classList.add('dragover');
  });
  el.dragDropZone.addEventListener('dragleave', () => {
    el.dragDropZone.classList.remove('dragover');
  });
  el.dragDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dragDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      el.ragFileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });

  el.btnClearFile.addEventListener('click', clearSelectedFile);
  el.ragFileForm.addEventListener('submit', handleRagFileSubmit);
  
  // Quiz Forms & Controls
  el.quizForm.addEventListener('submit', handleQuizGenerate);
  el.quizNextBtn.addEventListener('click', handleQuizNextStep);
  el.btnQuizRestart.addEventListener('click', resetQuizConfigView);
}

// Auth UI Toggle
function toggleAuthTabs(tab) {
  el.authError.classList.add('hidden');
  if (tab === 'login') {
    el.tabLogin.classList.add('active');
    el.tabRegister.classList.remove('active');
    el.formLogin.classList.remove('hidden');
    el.formRegister.classList.add('hidden');
  } else {
    el.tabLogin.classList.remove('active');
    el.tabRegister.classList.add('active');
    el.formLogin.classList.add('hidden');
    el.formRegister.classList.remove('hidden');
  }
}

// REST Call Helpers
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(endpoint, options);
  const data = await res.json();
  
  if (!res.ok) {
    if (res.status === 401) {
      handleLogout();
    }
    throw new Error(data.message || 'API request failed.');
  }
  
  return data;
}

// Authentication Actions
async function handleLogin(e) {
  e.preventDefault();
  el.authError.classList.add('hidden');
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const res = await apiCall('/api/auth/login', 'POST', { email, password });
    saveAuthSession(res.data.token, res.data.user.email);
  } catch (error) {
    showAuthError(error.message);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  el.authError.classList.add('hidden');
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  
  try {
    const res = await apiCall('/api/auth/register', 'POST', { email, password });
    saveAuthSession(res.data.token, res.data.user.email);
  } catch (error) {
    showAuthError(error.message);
  }
}

function saveAuthSession(token, email) {
  state.token = token;
  state.email = email;
  localStorage.setItem('token', token);
  localStorage.setItem('email', email);
  showWorkspace();
}

function handleLogout() {
  if (state.sseSource) {
    state.sseSource.close();
  }
  state.token = '';
  state.email = '';
  state.activeConversationId = '';
  localStorage.clear();
  showAuthScreen();
}

function showAuthError(msg) {
  el.authError.textContent = msg;
  el.authError.classList.remove('hidden');
}

// Navigation Tabs Switcher
function switchSection(section) {
  // Update nav UI
  el.navChat.classList.remove('active');
  el.navRag.classList.remove('active');
  el.navQuiz.classList.remove('active');
  
  el.secChat.classList.remove('active');
  el.secRag.classList.remove('active');
  el.secQuiz.classList.remove('active');
  
  if (section === 'chat') {
    el.navChat.classList.add('active');
    el.secChat.classList.add('active');
  } else if (section === 'rag') {
    el.navRag.classList.add('active');
    el.secRag.classList.add('active');
    loadRAGDocuments();
  } else if (section === 'quiz') {
    el.navQuiz.classList.add('active');
    el.secQuiz.classList.add('active');
    loadQuizHistory();
  }
}

// SECTION 1: TUTOR CHAT (Streaming Server-Sent Events)
function appendMessage(role, text, isMarkdown = false) {
  const isUser = role === 'user';
  
  const msgWrapper = document.createElement('div');
  msgWrapper.className = `message ${isUser ? 'user-msg' : 'model-msg'}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.innerHTML = isUser ? '<i data-lucide="user"></i>' : '<i data-lucide="sparkles"></i>';
  
  const body = document.createElement('div');
  body.className = 'msg-body';
  
  if (isUser) {
    body.textContent = text;
  } else if (isMarkdown) {
    body.innerHTML = marked.parse(text);
  } else {
    body.textContent = text;
  }
  
  msgWrapper.appendChild(avatar);
  msgWrapper.appendChild(body);
  el.chatMessages.appendChild(msgWrapper);
  
  // Re-generate icons inside injected html
  lucide.createIcons();
  
  // Scroll to bottom
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  return body; // Return reference to body for live text updates during streaming
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const question = el.chatInput.value.trim();
  if (!question) return;
  
  el.chatInput.value = '';
  
  // Add user prompt bubble
  appendMessage('user', question);
  
  // Add placeholder tutor bubble
  const responseBodyElement = appendMessage('model', '');
  responseBodyElement.innerHTML = '<span class="status-indicator"><span class="pulse green"></span>Tutor is formulating response...</span>';
  
  const isRag = el.checkboxRag.checked;
  
  try {
    // Connect to Server-Sent Events API endpoint
    const url = `/api/tutor/ask/stream?question=${encodeURIComponent(question)}&conversationId=${state.activeConversationId || ''}&ragMode=${isRag}&subject=${encodeURIComponent(state.selectedSubject)}&token=${state.token}`;
    
    if (state.sseSource) {
      state.sseSource.close();
    }
    
    state.sseSource = new EventSource(url);
    let streamedText = '';
    
    state.sseSource.onmessage = (event) => {
      if (event.data === '[DONE]') {
        state.sseSource.close();
        responseBodyElement.innerHTML = marked.parse(streamedText);
        return;
      }
      
      try {
        const payload = JSON.parse(event.data);
        
        if (payload.type === 'meta') {
          // Save conversationId for continuing the stateful dialog
          state.activeConversationId = payload.conversationId;
        } else if (payload.type === 'content') {
          if (streamedText === '') {
            responseBodyElement.innerHTML = '';
          }
          streamedText += payload.text;
          responseBodyElement.innerHTML = marked.parse(streamedText);
          el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
        } else if (payload.type === 'error') {
          state.sseSource.close();
          responseBodyElement.classList.add('text-pink');
          responseBodyElement.textContent = `Tutor Error: ${payload.message}`;
        }
      } catch (err) {
        console.error('Failed to parse SSE payload:', err);
      }
    };
    
    state.sseSource.onerror = (err) => {
      state.sseSource.close();
      responseBodyElement.classList.add('text-pink');
      responseBodyElement.textContent = 'Connection to the AI Tutor was lost or returned an error. Please verify the Gemini API key configuration.';
    };
    
  } catch (error) {
    responseBodyElement.classList.add('text-pink');
    responseBodyElement.textContent = `Failed to contact AI Tutor: ${error.message}`;
  }
}

// SECTION 2: STUDY MATERIALS (RAG)
async function handleRagSubmit(e) {
  e.preventDefault();
  const title = el.ragTitle.value.trim();
  const content = el.ragContent.value.trim();
  
  // Disable button while processing
  const submitBtn = document.getElementById('btn-rag-submit');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="status-indicator"><span class="pulse green"></span>Processing & Vectorizing...</span>';
  
  try {
    await apiCall('/api/rag/upload', 'POST', { title, content });
    
    el.ragTitle.value = '';
    el.ragContent.value = '';
    
    // Show success banner
    el.ragSuccessMsg.classList.remove('hidden');
    setTimeout(() => el.ragSuccessMsg.classList.add('hidden'), 5000);
    
    loadRAGDocuments();
  } catch (error) {
    alert(`Vector Ingestion Error: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="plus-circle"></i> Generate & Store Vectors';
    lucide.createIcons();
  }
}

async function loadRAGDocuments() {
  if (!state.token) return;
  
  try {
    const res = await apiCall('/api/rag/documents');
    el.documentsList.innerHTML = '';
    
    if (res.data.documents.length === 0) {
      el.documentsList.innerHTML = '<li class="empty-list-item">No documents uploaded yet.</li>';
      return;
    }
    
    res.data.documents.forEach(doc => {
      const li = document.createElement('li');
      const date = new Date(doc.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      li.innerHTML = `
        <div class="doc-info">
          <span class="doc-title">${doc.title}</span>
          <span class="doc-date">Uploaded ${date}</span>
        </div>
        <span class="status-indicator">
          <span class="pulse green"></span> Vector Indexed
        </span>
      `;
      el.documentsList.appendChild(li);
    });
  } catch (error) {
    console.error('Failed to load documents:', error);
  }
}

// SECTION 3: QUIZZES
async function handleQuizGenerate(e) {
  e.preventDefault();
  const topic = el.quizTopic.value.trim();
  const count = el.quizCount.value;
  
  const generateBtn = document.getElementById('btn-generate-quiz');
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="status-indicator"><span class="pulse green"></span>Gemini is drafting quiz...</span>';
  
  try {
    const res = await apiCall('/api/quiz/generate', 'POST', { topic, questionCount: count });
    
    // Save quiz in state
    state.activeQuiz = res.data;
    state.currentQuestionIndex = 0;
    state.selectedOptionIndex = null;
    state.quizAnswers = [];
    
    // Switch views
    el.quizSetupCard.classList.add('hidden');
    el.quizSheetCard.classList.remove('hidden');
    el.quizReportCard.classList.add('hidden');
    
    renderQuizQuestion();
  } catch (error) {
    alert(`Quiz Generation failed: ${error.message}`);
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i data-lucide="play-circle"></i> Generate Structured Quiz';
    lucide.createIcons();
  }
}

function renderQuizQuestion() {
  const quiz = state.activeQuiz;
  const qIndex = state.currentQuestionIndex;
  const question = quiz.questions[qIndex];
  
  el.quizSheetTitle.textContent = `${quiz.topic} Quiz`;
  el.quizProgressText.textContent = `Question ${qIndex + 1} of ${quiz.questions.length}`;
  
  el.quizQuestionContainer.innerHTML = `
    <div class="quiz-q-text">${question.question}</div>
    <div class="quiz-options" id="quiz-options-list">
      ${question.options.map((opt, idx) => `
        <button class="quiz-option-btn" data-index="${idx}">
          ${String.fromCharCode(65 + idx)}. ${opt}
        </button>
      `).join('')}
    </div>
    <div id="quiz-feedback-box" class="quiz-explanation-box hidden"></div>
  `;
  
  // Attach select handlers to options
  const optionButtons = document.querySelectorAll('.quiz-option-btn');
  optionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // If already submitted this question, don't allow re-selection
      if (state.quizAnswers.length > qIndex) return;
      
      optionButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedOptionIndex = parseInt(btn.dataset.index, 10);
      el.quizNextBtn.disabled = false;
    });
  });
  
  state.selectedOptionIndex = null;
  el.quizNextBtn.disabled = true;
  el.quizNextBtn.textContent = 'Submit Answer';
}

function handleQuizNextStep() {
  const qIndex = state.currentQuestionIndex;
  const quiz = state.activeQuiz;
  const question = quiz.questions[qIndex];
  
  // Step A: Submitting answer for current question
  if (state.quizAnswers.length === qIndex) {
    const selected = state.selectedOptionIndex;
    state.quizAnswers.push(selected);
    
    // Highlight options
    const optionButtons = document.querySelectorAll('.quiz-option-btn');
    optionButtons.forEach(btn => {
      const idx = parseInt(btn.dataset.index, 10);
      btn.classList.remove('selected');
      if (idx === question.correctAnswerIndex) {
        btn.classList.add('correct');
      } else if (idx === selected) {
        btn.classList.add('wrong');
      }
    });
    
    // Render explanation text
    const feedbackBox = document.getElementById('quiz-feedback-box');
    const isCorrect = selected === question.correctAnswerIndex;
    
    feedbackBox.innerHTML = `
      <p style="font-weight: 600; color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}; margin-bottom: 6px;">
        ${isCorrect ? '✓ Correct Answer!' : '✗ Incorrect Answer.'}
      </p>
      <p>${question.explanation}</p>
    `;
    feedbackBox.classList.remove('hidden');
    
    // Adjust button label
    if (qIndex === quiz.questions.length - 1) {
      el.quizNextBtn.textContent = 'Finish and Grade Quiz';
    } else {
      el.quizNextBtn.textContent = 'Next Question';
    }
  } 
  // Step B: Moving to next question or final evaluation
  else {
    state.currentQuestionIndex++;
    if (state.currentQuestionIndex < quiz.questions.length) {
      renderQuizQuestion();
    } else {
      submitQuizResults();
    }
  }
}

async function submitQuizResults() {
  el.quizSheetCard.classList.add('hidden');
  
  try {
    const res = await apiCall('/api/quiz/submit', 'POST', {
      quizId: state.activeQuiz.quizId,
      answers: state.quizAnswers
    });
    
    const report = res.data;
    el.reportScore.textContent = report.score;
    el.reportTotal.textContent = report.totalCount;
    el.reportPercentage.textContent = `${report.percentage}% Score`;
    
    el.reportFeedbackList.innerHTML = '';
    report.gradedQuestions.forEach((q, idx) => {
      const isCorrect = q.isCorrect;
      
      const item = document.createElement('div');
      item.className = `report-feedback-item ${isCorrect ? 'correct' : 'incorrect'}`;
      item.innerHTML = `
        <h4>Question ${idx + 1}: ${isCorrect ? 'Correct' : 'Incorrect'}</h4>
        <p style="font-weight: 500; margin-bottom: 6px;">${q.question}</p>
        <p style="font-size: 12px; color: var(--text-muted);">
          Your Answer: ${q.options[q.studentAnswer]} <br>
          Correct Answer: ${q.options[q.correctAnswerIndex]}
        </p>
        <p style="font-size: 12px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;">
          <strong>Explanation:</strong> ${q.explanation}
        </p>
      `;
      el.reportFeedbackList.appendChild(item);
    });
    
    el.quizReportCard.classList.remove('hidden');
    
    loadQuizHistory();
  } catch (error) {
    alert(`Failed to grade quiz: ${error.message}`);
    resetQuizConfigView();
  }
}

function resetQuizConfigView() {
  state.activeQuiz = null;
  el.quizSetupCard.classList.remove('hidden');
  el.quizSheetCard.classList.add('hidden');
  el.quizReportCard.classList.add('hidden');
  el.quizTopic.value = '';
}

async function loadQuizHistory() {
  if (!state.token) return;
  
  try {
    const res = await apiCall('/api/quiz/history');
    el.quizHistoryList.innerHTML = '';
    
    if (res.data.history.length === 0) {
      el.quizHistoryList.innerHTML = '<li class="empty-list-item">No quizzes taken yet.</li>';
      return;
    }
    
    res.data.history.forEach(attempt => {
      const date = new Date(attempt.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const pass = attempt.percentage >= 70;
      
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="doc-info">
          <span class="history-topic">${attempt.topic}</span>
          <span class="history-date">Completed ${date}</span>
        </div>
        <span class="history-score ${pass ? 'pass' : 'fail'}">
          ${attempt.score}/${attempt.totalCount} (${attempt.percentage}%)
        </span>
      `;
      el.quizHistoryList.appendChild(li);
    });
  } catch (error) {
    console.error('Failed to load quiz history:', error);
  }
}

// RAG Tab Switcher
function switchRagTab(tab) {
  el.ragTabFile.classList.remove('active');
  el.ragTabText.classList.remove('active');
  el.ragPanelFile.classList.remove('active');
  el.ragPanelText.classList.remove('active');

  if (tab === 'file') {
    el.ragTabFile.classList.add('active');
    el.ragPanelFile.classList.add('active');
  } else {
    el.ragTabText.classList.add('active');
    el.ragPanelText.classList.add('active');
  }
}

// File Selector Helpers
function handleFileSelect() {
  const file = el.ragFileInput.files[0];
  if (!file) return;

  state.selectedFile = file;
  el.selectedFileName.textContent = file.name;
  
  // Format file size
  let sizeStr = '';
  if (file.size < 1024 * 1024) {
    sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
  } else {
    sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }
  el.selectedFileSize.textContent = sizeStr;

  el.selectedFileInfo.classList.remove('hidden');
  el.btnFileSubmit.disabled = false;
}

function clearSelectedFile() {
  state.selectedFile = null;
  el.ragFileInput.value = '';
  el.selectedFileInfo.classList.add('hidden');
  el.btnFileSubmit.disabled = true;
}

// RAG File Ingestion Submit Action
async function handleRagFileSubmit(e) {
  e.preventDefault();
  if (!state.selectedFile) return;

  const submitBtn = el.btnFileSubmit;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="status-indicator"><span class="pulse green"></span>Ingesting & Vectorizing...</span>';

  const formData = new FormData();
  formData.append('file', state.selectedFile);

  try {
    const res = await fetch('/api/rag/upload-file', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        handleLogout();
      }
      throw new Error(data.message || 'File upload failed');
    }

    clearSelectedFile();

    // Show success banner
    el.ragSuccessMsgText.textContent = `File "${data.data.title}" successfully parsed and stored into SQLite vector database (${data.data.chunksCount} chunks).`;
    el.ragSuccessMsg.classList.remove('hidden');
    setTimeout(() => el.ragSuccessMsg.classList.add('hidden'), 6000);

    loadRAGDocuments();
  } catch (error) {
    alert(`File Ingestion Error: ${error.message}`);
  } finally {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="plus-circle"></i> Ingest & Vectorize File';
    lucide.createIcons();
  }
}

// Run initial configurations
document.addEventListener('DOMContentLoaded', init);
