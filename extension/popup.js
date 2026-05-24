let currentMode = 'current';
let analysisResult = null;

// Get current tab URL
async function updateCurrentUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    document.getElementById('currentUrl').innerHTML = `<span style="font-family: monospace;">${tab.url.substring(0, 60)}${tab.url.length > 60 ? '...' : ''}</span>`;
  } catch (error) {
    document.getElementById('currentUrl').textContent = 'Unable to get current tab';
  }
}

// Saved jobs button
document.getElementById('savedJobsBtn')?.addEventListener('click', async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('savedjobs.html'), active: true });
});

// Switch between modes
document.querySelectorAll('.option-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    
    document.getElementById('currentSection').classList.toggle('active', currentMode === 'current');
    document.getElementById('urlSection').classList.toggle('active', currentMode === 'url');
  });
});

// Validate button click
document.getElementById('validateBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Clear old data
  await chrome.storage.local.set({ 
    lastAnalysis: null,
    isLoading: true,
    error: null
  });
  
  statusDiv.innerHTML = `
    <div class="status loading">
      <div class="loader-text">
        Processing...
        <div class="dots">
          <span>.</span><span>.</span><span>.</span>
        </div>
      </div>
    </div>
  `;
  
  try {
    let url;
    
    if (currentMode === 'current') {
      url = tab.url;
      
      // Open sidepanel FIRST (user gesture)
      await chrome.sidePanel.open({ tabId: tab.id });
      
      // Get data from content script
      let jobData = null;
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobData' });
        jobData = response;
      } catch (err) {
        console.log('Content script not available:', err.message);
      }
      
      let result;
      if (jobData && jobData.description && jobData.description.length > 100) {
        const response = await fetch('http://localhost:8000/validate-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url,
            description: jobData.description,
            title: jobData.title,
            company: jobData.company,
            location: jobData.location,
            salary: jobData.salary
          })
        });
        result = await response.json();
      } else {
        const response = await fetch('http://localhost:8000/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        result = await response.json();
      }
      
      result.url = url;
      await chrome.storage.local.set({ lastAnalysis: result, isLoading: false, error: null });
      window.close();
      
    } else {
      // URL MODE
      url = document.getElementById('jobUrl').value.trim();
      if (!url) throw new Error('Please enter a job URL');
      if (!url.startsWith('http')) throw new Error('Please enter a valid URL starting with http:// or https://');
      
      // STEP 1: Open sidepanel FIRST (preserves user gesture)
      await chrome.sidePanel.open({ tabId: tab.id });
      console.log('[Popup] Sidepanel opened');
      
      // STEP 2: Show loading in sidepanel via storage
      await chrome.storage.local.set({ 
        isLoading: true,
        lastAnalysis: null,
        error: null
      });
      
      // STEP 3: Send URL to backend for analysis
      statusDiv.innerHTML = `
        <div class="status loading">
          <div class="loader-text">
            Analyzing job from URL...
            <div class="dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        </div>
      `;
      
      const response = await fetch('http://localhost:8000/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      result.url = url;
      
      console.log('[Popup] Backend analysis complete, score:', result.score);
      
      // STEP 4: Store the result
      await chrome.storage.local.set({ 
        lastAnalysis: result,
        isLoading: false,
        error: null
      });
      
      // STEP 5: Navigate current tab to the URL
      statusDiv.innerHTML = `
        <div class="status loading">
          <div class="loader-text">
            Opening job page...
            <div class="dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        </div>
      `;
      
      await chrome.tabs.update(tab.id, { url: url });
      
      console.log('[Popup] Complete, closing popup');
      window.close();
    }
    
  } catch (error) {
    console.error('Popup Error:', error);
    await chrome.storage.local.set({ 
      lastAnalysis: null,
      isLoading: false,
      error: error.message 
    });
    statusDiv.innerHTML = `<div class="status error">Error: ${error.message}<br><br>Make sure backend is running on localhost:8000</div>`;
  }
});

// Initialize
updateCurrentUrl();