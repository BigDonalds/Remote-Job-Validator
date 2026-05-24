chrome.runtime.onInstalled.addListener(() => {
  console.log('Remote Job Validator installed');
  
  chrome.alarms.create('cleanSavedJobs', { periodInMinutes: 1440 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanSavedJobs') {
    const { savedJobs } = await chrome.storage.local.get('savedJobs');
    if (savedJobs && savedJobs.length > 0) {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const cleaned = savedJobs.filter(job => job.savedAt > thirtyDaysAgo);
      await chrome.storage.local.set({ savedJobs: cleaned });
    }
  }
});

//  sidepanel opens when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeJob') {
    fetch('http://localhost:8000/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: request.url })
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, data: data }))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (request.action === 'analysisComplete') {
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'openPopup') {
    chrome.action.openPopup();
    sendResponse({ success: true });
    return true;
  }
});