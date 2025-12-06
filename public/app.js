// API Base URL
const API_BASE = '/api';

// State
let emails = [];
let errors = [];
let config = {};
let selectedEmailId = null;
let viewMode = 'html';

// DOM Elements
const elements = {
  emailCount: document.getElementById('emailCount'),
  errorCount: document.getElementById('errorCount'),
  configPanel: document.getElementById('configPanel'),
  toggleConfig: document.getElementById('toggleConfig'),
  emailItems: document.getElementById('emailItems'),
  emptyState: document.getElementById('emptyState'),
  emailContent: document.getElementById('emailContent'),
  noEmailSelected: document.getElementById('noEmailSelected'),
  emailSubject: document.getElementById('emailSubject'),
  emailFrom: document.getElementById('emailFrom'),
  emailTo: document.getElementById('emailTo'),
  emailReceived: document.getElementById('emailReceived'),
  emailBodyFrame: document.getElementById('emailBodyFrame'),
  emailBodyText: document.getElementById('emailBodyText'),
  emailAttachments: document.getElementById('emailAttachments'),
  attachmentList: document.getElementById('attachmentList'),
  searchInput: document.getElementById('searchInput'),
  clearAll: document.getElementById('clearAll'),
  errorBanner: document.getElementById('errorBanner'),
  errorMessage: document.getElementById('errorMessage'),
  clearErrors: document.getElementById('clearErrors'),
  saveConfig: document.getElementById('saveConfig'),
  viewHtml: document.getElementById('viewHtml'),
  viewText: document.getElementById('viewText'),
  deleteEmail: document.getElementById('deleteEmail'),
  
  // Config inputs
  rateLimitEnabled: document.getElementById('rateLimitEnabled'),
  maxPerSecond: document.getElementById('maxPerSecond'),
  latencyEnabled: document.getElementById('latencyEnabled'),
  minLatency: document.getElementById('minLatency'),
  maxLatency: document.getElementById('maxLatency'),
};

// API Functions
async function fetchEmails() {
  try {
    const response = await fetch(`${API_BASE}/emails`);
    emails = await response.json();
    renderEmailList();
    updateStats();
  } catch (error) {
    console.error('Failed to fetch emails:', error);
  }
}

async function fetchErrors() {
  try {
    const response = await fetch(`${API_BASE}/errors`);
    errors = await response.json();
    updateErrorBanner();
    updateStats();
  } catch (error) {
    console.error('Failed to fetch errors:', error);
  }
}

async function fetchConfig() {
  try {
    const response = await fetch(`${API_BASE}/config`);
    config = await response.json();
    updateConfigUI();
  } catch (error) {
    console.error('Failed to fetch config:', error);
  }
}

async function saveConfig() {
  try {
    const newConfig = {
      rateLimit: {
        enabled: elements.rateLimitEnabled.checked,
        maxPerSecond: parseInt(elements.maxPerSecond.value) || 1,
      },
      latency: {
        enabled: elements.latencyEnabled.checked,
        minMs: parseInt(elements.minLatency.value) || 0,
        maxMs: parseInt(elements.maxLatency.value) || 0,
      },
    };
    
    const response = await fetch(`${API_BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
    
    config = await response.json();
    showToast('Configuration saved!', 'success');
  } catch (error) {
    console.error('Failed to save config:', error);
    showToast('Failed to save configuration', 'error');
  }
}

async function deleteEmail(id) {
  try {
    await fetch(`${API_BASE}/emails/${id}`, { method: 'DELETE' });
    await fetchEmails();
    if (selectedEmailId === id) {
      selectedEmailId = null;
      showEmailDetail(null);
    }
  } catch (error) {
    console.error('Failed to delete email:', error);
  }
}

async function clearAllEmails() {
  if (!confirm('Are you sure you want to delete all emails?')) return;
  
  try {
    await fetch(`${API_BASE}/emails`, { method: 'DELETE' });
    await fetch(`${API_BASE}/errors`, { method: 'DELETE' });
    await fetchEmails();
    await fetchErrors();
    selectedEmailId = null;
    showEmailDetail(null);
  } catch (error) {
    console.error('Failed to clear emails:', error);
  }
}

async function clearErrors() {
  try {
    await fetch(`${API_BASE}/errors`, { method: 'DELETE' });
    await fetchErrors();
  } catch (error) {
    console.error('Failed to clear errors:', error);
  }
}

// UI Functions
function renderEmailList() {
  const searchTerm = elements.searchInput.value.toLowerCase();
  const filteredEmails = emails.filter(email => {
    return (
      email.subject.toLowerCase().includes(searchTerm) ||
      email.from.toLowerCase().includes(searchTerm) ||
      email.to.toLowerCase().includes(searchTerm) ||
      email.text.toLowerCase().includes(searchTerm)
    );
  });
  
  if (filteredEmails.length === 0) {
    elements.emptyState.style.display = 'flex';
    elements.emailItems.innerHTML = '';
    elements.emailItems.appendChild(elements.emptyState);
    return;
  }
  
  elements.emptyState.style.display = 'none';
  elements.emailItems.innerHTML = filteredEmails.map(email => `
    <div class="email-item ${email.id === selectedEmailId ? 'active' : ''}" data-id="${email.id}">
      <div class="email-item-header">
        <span class="email-item-from">${escapeHtml(extractName(email.from))}</span>
        <span class="email-item-time">${formatTime(email.receivedAt)}</span>
      </div>
      <div class="email-item-subject">${escapeHtml(email.subject)}</div>
      <div class="email-item-preview">${escapeHtml(email.text.substring(0, 100))}</div>
    </div>
  `).join('');
  
  // Add click handlers
  elements.emailItems.querySelectorAll('.email-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      selectEmail(id);
    });
  });
}

function selectEmail(id) {
  selectedEmailId = id;
  const email = emails.find(e => e.id === id);
  showEmailDetail(email);
  renderEmailList();
}

function showEmailDetail(email) {
  if (!email) {
    elements.emailContent.style.display = 'none';
    elements.noEmailSelected.style.display = 'flex';
    return;
  }
  
  elements.noEmailSelected.style.display = 'none';
  elements.emailContent.style.display = 'flex';
  
  elements.emailSubject.textContent = email.subject;
  elements.emailFrom.textContent = email.from;
  elements.emailTo.textContent = email.to;
  elements.emailReceived.textContent = formatDate(email.receivedAt);
  
  // Set email body
  if (viewMode === 'html' && email.html) {
    elements.emailBodyFrame.style.display = 'block';
    elements.emailBodyText.style.display = 'none';
    
    const doc = elements.emailBodyFrame.contentDocument || elements.emailBodyFrame.contentWindow.document;
    doc.open();
    doc.write(email.html);
    doc.close();
  } else {
    elements.emailBodyFrame.style.display = 'none';
    elements.emailBodyText.style.display = 'block';
    elements.emailBodyText.textContent = email.text || '(No text content)';
  }
  
  // Show attachments
  if (email.attachments && email.attachments.length > 0) {
    elements.emailAttachments.style.display = 'block';
    elements.attachmentList.innerHTML = email.attachments.map(att => {
      const isImage = att.contentType?.startsWith('image/');
      const isPdf = att.contentType === 'application/pdf';
      const downloadUrl = `/api/emails/${email.id}/attachments/${att.id}`;
      const previewUrl = `/api/emails/${email.id}/attachments/${att.id}/inline`;
      
      let icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
      </svg>`;
      
      if (isImage) {
        icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>`;
      } else if (isPdf) {
        icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>`;
      }
      
      let preview = '';
      if (isImage) {
        preview = `<img src="${previewUrl}" alt="${escapeHtml(att.filename)}" class="attachment-preview" onclick="window.open('${previewUrl}', '_blank')">`;
      }
      
      return `
        <div class="attachment-item ${isImage ? 'attachment-image' : ''}">
          ${preview}
          <div class="attachment-info">
            ${icon}
            <span class="attachment-name">${escapeHtml(att.filename)}</span>
            <span class="attachment-size">(${formatSize(att.size)})</span>
            <a href="${downloadUrl}" download="${escapeHtml(att.filename)}" class="attachment-download" title="Download">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </a>
          </div>
        </div>
      `;
    }).join('');
  } else {
    elements.emailAttachments.style.display = 'none';
  }
}

function updateStats() {
  elements.emailCount.textContent = emails.length;
  elements.errorCount.textContent = errors.length;
}

function updateErrorBanner() {
  if (errors.length === 0) {
    elements.errorBanner.style.display = 'none';
    return;
  }
  
  const latestError = errors[0];
  elements.errorBanner.style.display = 'block';
  const errorCode = latestError.code ? `[${latestError.code}] ` : '';
  const errorType = latestError.type ? `(${latestError.type.replace('_', ' ')}) ` : '';
  elements.errorMessage.textContent = `${errorCode}${latestError.message} - From: ${latestError.from}`;
}

function updateConfigUI() {
  elements.rateLimitEnabled.checked = config.rateLimit?.enabled ?? true;
  elements.maxPerSecond.value = config.rateLimit?.maxPerSecond ?? 1;
  elements.latencyEnabled.checked = config.latency?.enabled ?? false;
  elements.minLatency.value = config.latency?.minMs ?? 0;
  elements.maxLatency.value = config.latency?.maxMs ?? 0;
}

function toggleConfigPanel() {
  elements.configPanel.classList.toggle('active');
}

function setViewMode(mode) {
  viewMode = mode;
  if (selectedEmailId) {
    const email = emails.find(e => e.id === selectedEmailId);
    showEmailDetail(email);
  }
  
  // Update button states
  elements.viewHtml.classList.toggle('active', mode === 'html');
  elements.viewText.classList.toggle('active', mode === 'text');
}

// Toast notification
function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${type === 'success' 
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
          : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
        }
      </svg>
      <div class="toast-message">
        <p>${escapeHtml(message)}</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Utility Functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function extractName(from) {
  const match = from.match(/^"?([^"<]+)"?\s*<?/);
  return match ? match[1].trim() : from;
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Event Listeners
elements.toggleConfig.addEventListener('click', toggleConfigPanel);
elements.saveConfig.addEventListener('click', saveConfig);
elements.clearAll.addEventListener('click', clearAllEmails);
elements.clearErrors.addEventListener('click', clearErrors);
elements.searchInput.addEventListener('input', renderEmailList);
elements.viewHtml.addEventListener('click', () => setViewMode('html'));
elements.viewText.addEventListener('click', () => setViewMode('text'));
elements.deleteEmail.addEventListener('click', () => {
  if (selectedEmailId) {
    deleteEmail(selectedEmailId);
  }
});

// Initialize
async function init() {
  await Promise.all([
    fetchConfig(),
    fetchEmails(),
    fetchErrors(),
  ]);
  
  // Poll for updates every 2 seconds
  setInterval(async () => {
    await fetchEmails();
    await fetchErrors();
  }, 2000);
}

init();

