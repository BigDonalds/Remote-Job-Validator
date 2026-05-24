async function loadSavedJobs() {
  const jobListDiv = document.getElementById('jobList');
  const statsDiv = document.getElementById('stats');
  
  const { savedJobs } = await chrome.storage.local.get('savedJobs');
  const jobs = savedJobs || [];
  
  if (jobs.length === 0) {
    statsDiv.innerHTML = '0 jobs saved';
    jobListDiv.innerHTML = `
      <div class="empty-state">
        <p>No jobs saved yet</p>
      </div>
    `;
    document.getElementById('goBackBtn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
    return;
  }
  
  // Sort by saved date (newest first)
  jobs.sort((a, b) => b.savedAt - a.savedAt);
  
  statsDiv.innerHTML = `${jobs.length} job${jobs.length !== 1 ? 's' : ''} saved`;
  
  // Get score color class
  function getScoreClass(score) {
    if (score >= 65) return 'score-high';
    if (score >= 45) return 'score-mid';
    return 'score-low';
  }
  
  // Format date
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
  
  jobListDiv.innerHTML = jobs.map((job, index) => `
    <div class="job-card" data-index="${index}">
      <div class="job-title">${escapeHtml(job.title || 'Unknown Title')}</div>
      <div class="job-company">${escapeHtml(job.company || 'Unknown Company')}</div>
      <div class="job-score ${getScoreClass(job.score)}">Score: ${job.score}/100</div>
      <div class="job-url">${escapeHtml(job.url.substring(0, 80))}${job.url.length > 80 ? '...' : ''}</div>
      <div class="saved-date">Saved: ${formatDate(job.savedAt)}</div>
      <div class="job-actions">
        <button class="go-btn" data-url="${escapeHtml(job.url)}">Go to Job</button>
        <button class="delete-btn" data-url="${escapeHtml(job.url)}">Delete</button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners for go buttons
  document.querySelectorAll('.go-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-url');
      await chrome.tabs.create({ url: url, active: true });
    });
  });
  
  // Add event listeners for delete buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const urlToDelete = btn.getAttribute('data-url');
      const { savedJobs } = await chrome.storage.local.get('savedJobs');
      const updatedJobs = (savedJobs || []).filter(job => job.url !== urlToDelete);
      await chrome.storage.local.set({ savedJobs: updatedJobs });
      loadSavedJobs(); // Refresh the list
    });
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Clear all button
document.getElementById('clearAllBtn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete all saved jobs?')) {
    await chrome.storage.local.set({ savedJobs: [] });
    loadSavedJobs();
  }
});

// Back button - open popup
document.getElementById('backBtn')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'openPopup' });
});

// Load jobs on page load
loadSavedJobs();