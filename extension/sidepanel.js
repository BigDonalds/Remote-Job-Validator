async function loadAnalysis() {
  const container = document.getElementById('content');
  
  container.innerHTML = `
    <div class="loading">
      <div style="font-size: 48px; margin-bottom: 16px;"></div>
      <div>Analyzing job posting...</div>
      <div style="font-size: 12px; margin-top: 8px; color: #999;">Please wait while we validate this job</div>
      <div style="margin-top: 16px;">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
  
  if (!document.querySelector('#spinner-style')) {
    const style = document.createElement('style');
    style.id = 'spinner-style';
    style.textContent = `
      .loading-spinner {
        width: 40px;
        height: 40px;
        margin: 0 auto;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #764ba2;
        border-right: 3px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .save-btn {
        padding: 10px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        margin-top: 12px;
        width: 100%;
      }
      .save-btn.saved {
        background: #4caf50;
      }
      .dead-alert {
        background: #ffebee;
        border-left: 4px solid #f44336;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .fresh-alert {
        background: #e8f5e9;
        border-left: 4px solid #4caf50;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .stale-alert {
        background: #fff3e0;
        border-left: 4px solid #ff9800;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .score-breakdown {
        background: #f5f5f5;
        border-radius: 12px;
        padding: 12px;
        margin: 12px 0;
      }
      .score-bar {
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
        margin: 8px 0;
      }
      .score-fill {
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 4px;
        width: 0%;
      }
      .business-signal {
        font-size: 11px;
        color: #666;
        padding: 4px 0;
      }
      .business-signal.good {
        color: #4caf50;
      }
      .business-signal.warning {
        color: #ff9800;
      }
      .commission-warning {
        background: #fff3e0;
        border-radius: 8px;
        padding: 8px;
        margin: 8px 0;
        font-size: 12px;
        color: #e65100;
      }
      .unpaid-warning {
        background: #ffebee;
        border-radius: 8px;
        padding: 8px;
        margin: 8px 0;
        font-size: 12px;
        color: #c62828;
      }
      .copy-btn {
        padding: 10px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        width: 100%;
      }
    `;
    document.head.appendChild(style);
  }
  
  async function checkForData() {
    try {
      const { lastAnalysis, isLoading, error, savedJobs } = await chrome.storage.local.get(['lastAnalysis', 'isLoading', 'error', 'savedJobs']);
      
      if (error) {
        container.innerHTML = `<div class="loading">Error: ${escapeHtml(error)}</div>`;
        return true;
      }
      
      if (lastAnalysis && !isLoading) {
        renderAnalysis(lastAnalysis, container, savedJobs || []);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Sidepanel error:', error);
      container.innerHTML = `<div class="loading">Error: ${escapeHtml(error.message)}</div>`;
      return true;
    }
  }
  
  let done = await checkForData();
  
  if (!done) {
    const interval = setInterval(async () => {
      const completed = await checkForData();
      if (completed) clearInterval(interval);
    }, 500);
    
    setTimeout(() => {
      clearInterval(interval);
      if (container.innerHTML.includes('Analyzing job posting')) {
        container.innerHTML = `<div class="loading">Timeout - backend may not be running</div>`;
      }
    }, 30000);
  }
}

function renderAnalysis(result, container, savedJobs) {
  const gradientStyle = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  
  // USE BACKEND VALUES
  const backendScore = result.score || 0;
  const backendVerdict = result.verdict || 'UNKNOWN';
  const responseProbability = result.response_probability || 50;
  const payFairness = result.pay_fairness || 50;
  
  // Map verdict for display
  let displayVerdict = backendVerdict;
  if (backendVerdict === 'HIGH_QUALITY_LEGIT') {
    displayVerdict = 'LEGITIMATE - High Quality';
  } else if (backendVerdict === 'LEGIT_BUT_LOW_QUALITY') {
    displayVerdict = 'LEGITIMATE - Low Quality';
  } else if (backendVerdict === 'SUSPICIOUS') {
    displayVerdict = 'SUSPICIOUS - Proceed with Caution';
  } else if (backendVerdict === 'LIKELY_SCAM') {
    displayVerdict = 'LIKELY A SCAM - Avoid';
  }
  
  // Extract salary from backend
  let salaryText = 'No salary information provided';
  if (result.salaries_found && result.salaries_found.length > 0) {
    salaryText = result.salaries_found.join(', ');
  } else if (result.details?.salary?.message) {
    salaryText = result.details.salary.message;
  }
  
  // Clean up messages
  salaryText = salaryText.replace(/[✅✓⚠️💰🏆]/g, '').trim();
  
  // Clean flags
  let redFlags = result.details?.red_flags || [];
  let greenFlags = result.details?.green_flags || [];
  let summary = result.summary || [];
  
  redFlags = redFlags.map(f => f.replace(/[✅✓⚠️💰🏢🚩❌⚡]/g, '').trim());
  greenFlags = greenFlags.map(f => f.replace(/[✅✓⚠️💰🏢🚩❌⚡]/g, '').trim());
  summary = summary.map(s => s.replace(/[✅✓⚠️💰🏢🚩❌⚡]/g, '').trim());
  
  // Determine score color based on backend score
  let scoreColor = '#666';
  if (backendScore >= 80) scoreColor = '#4caf50';
  else if (backendScore >= 65) scoreColor = '#ff9800';
  else if (backendScore >= 45) scoreColor = '#ff9800';
  else scoreColor = '#f44336';
  
  // Build return on effort section using backend values
  let roeHtml = `
    <div class="score-breakdown">
      <div><strong>Response Probability:</strong> ${responseProbability}%</div>
      <div><strong>Pay Fairness:</strong> ${payFairness}%</div>
      <div class="score-bar" style="margin-top: 12px;"><div class="score-fill" style="width: ${backendScore}%;"></div></div>
      <div style="margin-top: 8px; font-weight: 600;">Final: ${backendScore}/100</div>
    </div>
  `;
  
  // Build market comparison
  let marketHtml = `<div class="info">${salaryText}</div>`;
  
  // Build real business score
  let businessScoreValue = 30;
  let businessSignals = [];
  const domainMsg = result.details?.domain?.message || '';
  
  if (domainMsg.includes('years old') || domainMsg.includes('well-established')) {
    businessScoreValue = 65;
    businessSignals.push('Professional domain with history');
  } else if (domainMsg.includes('months old')) {
    businessScoreValue = 45;
    businessSignals.push('Newer domain');
  } else {
    businessSignals.push('Could not verify domain');
  }
  
  if (greenFlags.some(f => f.toLowerCase().includes('accommodation') || f.toLowerCase().includes('inclusive'))) {
    businessScoreValue += 10;
    businessSignals.push('Inclusive hiring practices');
  }
  
  businessScoreValue = Math.min(100, businessScoreValue);
  
  let businessHtml = `
    <div style="margin-top: 8px;">
      <strong>Score: ${businessScoreValue}/100</strong>
      <div class="score-bar" style="margin-top: 8px;"><div class="score-fill" style="width: ${businessScoreValue}%;"></div></div>
      ${businessSignals.map(signal => `<div class="business-signal">${escapeHtml(signal)}</div>`).join('')}
    </div>
  `;
  
  // Check if job is already saved
  const isSaved = savedJobs ? savedJobs.some(job => job.url === result.url) : false;
  
  container.innerHTML = `
    <div class="header">
      <h3>Job Analysis</h3>
      <div class="company-name">${escapeHtml(result.company || 'Unknown Company')}</div>
      ${result.title ? `<div class="job-title">${escapeHtml(result.title.substring(0, 80))}${result.title.length > 80 ? '...' : ''}</div>` : ''}
    </div>
    
    <div class="score-card">
      <div class="score" style="color: ${scoreColor}">
        ${backendScore}<span style="font-size: 20px;">/100</span>
      </div>
      <div class="verdict" style="background: ${gradientStyle}; color: white;">${escapeHtml(displayVerdict)}</div>
    </div>
    
    <div class="section">
      <div class="section-title">Return on Effort Score</div>
      ${roeHtml}
    </div>
    
    <div class="section">
      <div class="section-title">Market Rate Comparison</div>
      ${marketHtml}
    </div>
    
    <div class="section">
      <div class="section-title">Real Business Score</div>
      ${businessHtml}
    </div>
    
    <div class="section">
      <div class="section-title">Summary</div>
      ${summary.length > 0 ? summary.map(s => `<div class="summary-item">• ${escapeHtml(s)}</div>`).join('') : '<div class="info">No summary available</div>'}
    </div>
    
    <div class="section">
      <div class="section-title">Red Flags</div>
      ${redFlags.length > 0 ? redFlags.map(flag => `<div class="red-flag">• ${escapeHtml(flag)}</div>`).join('') : '<div class="info">No red flags detected</div>'}
    </div>
    
    <div class="section">
      <div class="section-title">Green Flags</div>
      ${greenFlags.length > 0 ? greenFlags.map(flag => `<div class="green-flag">• ${escapeHtml(flag)}</div>`).join('') : '<div class="info">No green flags detected</div>'}
    </div>
    
    <div class="section">
      <div class="section-title">Company Check</div>
      <div class="info">${escapeHtml(result.details?.domain?.message?.replace(/[✅✓⚠️]/g, '').trim() || 'No domain data')}</div>
    </div>
    
    <div style="text-align: center; margin-top: 20px;">
      <button id="saveJobBtn" class="save-btn ${isSaved ? 'saved' : ''}">${isSaved ? 'Remove from List' : 'Save Job to List'}</button>
      <button id="copyBtn" class="copy-btn" style="margin-top: 8px;">Copy Report</button>
    </div>
  `;
  
  document.getElementById('copyBtn')?.addEventListener('click', () => {
    const reportText = `
JOB VALIDATION REPORT
========================================

Job: ${result.title || 'N/A'}
Company: ${result.company || 'N/A'}
Verdict: ${displayVerdict} (${backendScore}/100)

RETURN ON EFFORT
- Response Probability: ${responseProbability}%
- Pay Fairness: ${payFairness}%
- Overall Score: ${backendScore}/100

SUMMARY
${summary.map(s => '- ' + s).join('\n')}

RED FLAGS
${redFlags.length > 0 ? redFlags.map(f => '- ' + f).join('\n') : '- None detected'}

GREEN FLAGS
${greenFlags.length > 0 ? greenFlags.map(f => '- ' + f).join('\n') : '- None detected'}

COMPENSATION
${salaryText}

========================================
Validated by Remote Job Validator
    `.trim();
    
    navigator.clipboard.writeText(reportText);
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Report'; }, 2000);
  });
  
  // Toggle save/remove button
  document.getElementById('saveJobBtn')?.addEventListener('click', async () => {
    const { savedJobs } = await chrome.storage.local.get('savedJobs');
    const jobs = savedJobs || [];
    const exists = jobs.some(job => job.url === result.url);
    
    if (exists) {
      // Remove from saved jobs
      const updatedJobs = jobs.filter(job => job.url !== result.url);
      await chrome.storage.local.set({ savedJobs: updatedJobs });
      const btn = document.getElementById('saveJobBtn');
      btn.textContent = 'Save Job to List';
      btn.classList.remove('saved');
    } else {
      // Add to saved jobs
      const jobToSave = {
        url: result.url,
        title: result.title,
        company: result.company,
        score: backendScore,
        verdict: displayVerdict,
        savedAt: Date.now()
      };
      jobs.push(jobToSave);
      await chrome.storage.local.set({ savedJobs: jobs });
      const btn = document.getElementById('saveJobBtn');
      btn.textContent = 'Remove from List';
      btn.classList.add('saved');
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

loadAnalysis();