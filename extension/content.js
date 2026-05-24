console.log('Remote Job Validator content script loaded');

const MARKET_SALARIES = {
  'software engineer': 55,
  'software developer': 50,
  'web developer': 40,
  'frontend developer': 45,
  'backend developer': 55,
  'full stack developer': 52,
  'data scientist': 60,
  'data analyst': 40,
  'product manager': 65,
  'project manager': 50,
  'qa engineer': 40,
  'devops engineer': 60,
  'system administrator': 45,
  'network engineer': 45,
  'cybersecurity analyst': 55,
  'ux designer': 45,
  'ui designer': 42,
  'graphic designer': 35,
  'marketing manager': 45,
  'sales manager': 50,
  'customer support': 20,
  'virtual assistant': 18,
  'content writer': 30,
  'copywriter': 35,
  'editor': 35,
  'translator': 25,
  'teacher': 25,
  'tutor': 22,
  'accountant': 40,
  'bookkeeper': 30,
  'administrative assistant': 22,
  'executive assistant': 28,
  'recruiter': 35,
  'hr generalist': 35,
  'business analyst': 50,
  'operations manager': 55,
  'general labor': 20,
  'warehouse associate': 18,
  'delivery driver': 20,
  'cleaner': 16,
  'cashier': 14,
  'retail associate': 15,
  'call center': 17,
  'data entry': 16
};

const COMMISSION_KEYWORDS = [
  'commission only', '100% commission', 'uncapped commission',
  'commission-based', 'commission based', 'eat what you kill',
  'no base salary', 'draw against commission', 'straight commission',
  'full commission', 'performance based pay'
];

const EQUITY_KEYWORDS = [
  'equity only', 'equity compensation', 'stock options only',
  'sweat equity', 'founder equity', 'no salary equity'
];

const UNPAID_TRIAL_KEYWORDS = [
  'unpaid trial', 'test project', 'sample work', 'assessment task',
  '2 month task', '3 month trial', 'unpaid internship',
  'stipend only', 'volunteer position', 'for portfolio',
  'unpaid probation', 'trial period unpaid', 'unpaid training'
];

const RED_FLAGS = [
  'pay for training', 'upfront fee', 'deposit required', 
  'wire transfer', 'western union', 'registration fee',
  'buy your own equipment', 'guaranteed income', 'make $1000',
  'no experience needed', 'be your own boss', 'pyramid', 'mlm',
  'cryptocurrency', 'bitcoin', 'unlimited earning potential',
  'work from home', 'remote work', '100% commission', 'press release',
  'envelope stuffing', 'reship packages', 'mystery shopper',
  'google ad reviewer', 'facebook ads manager', 'crypto trading'
];

const GREEN_FLAGS = [
  'salary range', 'health insurance', '401k', 'paid time off',
  'equity', 'remote first', 'distributed team', 'pto',
  'dental', 'vision', 'retirement plan', 'tuition reimbursement',
  'stock options', 'bonus', 'commuter benefits', 'life insurance',
  'disability insurance', 'parental leave', 'flexible hours',
  'professional development', 'training provided', 'company laptop',
  'home office stipend', 'wellness stipend', '401k matching'
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'highlight') {
    highlightOnPage(request.results);
    sendResponse({ success: true });
  }
  
  if (request.action === 'getJobData') {
    const jobData = extractJobDataFromPage();
    sendResponse(jobData);
    return true;
  }
});

function extractJobDataFromPage() {
  console.log('[Content] Extracting job data from page...');
  
  let description = '';
  let title = '';
  let company = '';
  let salary = '';
  let postedDate = '';
  let location = '';
  
  if (window.location.href.includes('weworkremotely.com')) {
    console.log('[Content] WeWorkRemotely detected');
    
    const titleElem = document.querySelector('h1');
    if (titleElem) title = titleElem.innerText;
    
    const companyElem = document.querySelector('.lis-container__header__hero__company-info h3, .company-name');
    if (companyElem) company = companyElem.innerText;
    
    const descElem = document.querySelector('.lis-container__job__content__description');
    if (descElem) description = descElem.innerText;
    
    const locationElem = document.querySelector('.location, .job-location');
    if (locationElem) location = locationElem.innerText;
    
    if (description) {
      description = description.replace(/\s+/g, ' ').trim();
      return { description, title, company, salary, location, postedDate, url: window.location.href };
    }
  }
  
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (let script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      if (data['@type'] === 'JobPosting') {
        description = data.description || '';
        title = data.title || '';
        company = data.hiringOrganization?.name || '';
        location = data.jobLocation?.address?.addressLocality || '';
        postedDate = data.datePosted || '';
        
        if (data.baseSalary) {
          const salaryValue = data.baseSalary.value?.value || data.baseSalary.value;
          const salaryUnit = data.baseSalary.value?.unitText || data.baseSalary.unitText || '';
          if (salaryValue) {
            salary = `$${salaryValue}${salaryUnit ? ' ' + salaryUnit : ''}`;
          }
        }
        
        description = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        break;
      }
    } catch (e) {}
  }
  
  if (!description && window._initialData) {
    try {
      const data = window._initialData;
      let jobData = data?.body?.hostQueryExecutionResult?.data?.jobData?.results?.[0]?.job;
      if (!jobData) {
        jobData = data?.autoOpenTwoPaneViewjobResponse?.body?.hostQueryExecutionResult?.data?.jobData?.results?.[0]?.job;
      }
      
      if (jobData) {
        description = jobData?.description?.text || '';
        title = jobData?.title || '';
        company = jobData?.sourceEmployerName || jobData?.employer?.name || '';
        location = jobData?.location?.formatted?.short || jobData?.location?.city || '';
        
        if (jobData?.datePosted) {
          postedDate = jobData.datePosted;
        } else if (jobData?.dateOnIndeed) {
          postedDate = new Date(jobData.dateOnIndeed).toISOString();
        }
        
        if (jobData?.compensation) {
          const compensationKey = jobData.compensation.key;
          if (compensationKey) {
            try {
              const decoded = atob(compensationKey);
              const salaryMatch = decoded.match(/value[=:]\s*([\d.]+)/i);
              if (salaryMatch) {
                salary = `$${salaryMatch[1]} ${jobData?.compensation?.salaryType || 'per hour'}`;
              }
            } catch (e) {}
          }
        }
        
        if (!salary && jobData?.attributes) {
          const payAttr = jobData.attributes.find(attr => 
            attr.label && (attr.label.includes('$') || attr.label.includes('hour'))
          );
          if (payAttr) salary = payAttr.label;
        }
      }
    } catch (e) {}
  }
  
  if (!salary) {
    const salarySelectors = [
      '#salaryInfoAndJobType span:first-child',
      '[data-testid="jobsearch-JobInfoHeader-salary"]',
      '.jobsearch-JobMetadataHeader-item span',
      '.salary-snippet-container',
      '.css-1oc7tea span'
    ];
    
    for (let selector of salarySelectors) {
      const elem = document.querySelector(selector);
      if (elem && elem.innerText && elem.innerText.includes('$')) {
        salary = elem.innerText.trim();
        break;
      }
    }
    
    if (!salary) {
      const salaryMatch = document.body.innerText.match(/\$[\d,]+(?:\s*-\s*\$?[\d,]+)?(?:\s*(?:an?|per)\s*(?:hour|hr|day|week|month|year))?/i);
      if (salaryMatch) salary = salaryMatch[0];
    }
  }
  
  if (!postedDate) {
    const dateSelectors = [
      '[data-testid="jobsearch-JobInfoHeader-date"]',
      '.jobsearch-JobMetadataHeader-item:last-child',
      '.date-posted',
      '.posted-date'
    ];
    
    for (let selector of dateSelectors) {
      const elem = document.querySelector(selector);
      if (elem && elem.innerText) {
        const dateText = elem.innerText.toLowerCase();
        if (dateText.includes('day') || dateText.includes('hour') || dateText.includes('week')) {
          postedDate = dateText;
          break;
        }
      }
    }
  }
  
  if (!location) {
    const locationSelectors = [
      '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
      '.job-location',
      '.location',
      '.css-1wiq240'
    ];
    
    for (let selector of locationSelectors) {
      const elem = document.querySelector(selector);
      if (elem && elem.innerText) {
        location = elem.innerText.trim();
        break;
      }
    }
  }
  
  if (!description) {
    const descSelectors = [
      '.job-description', '.description', '#jobDescriptionText',
      '.job-details', '.lis-container__job__content__description',
      '.jobsearch-JobComponent-description'
    ];
    for (let selector of descSelectors) {
      const elem = document.querySelector(selector);
      if (elem) {
        description = elem.innerText;
        if (description && description.length > 200) break;
      }
    }
    
    if (!title) {
      const titleElem = document.querySelector('h1, .job-title, [data-testid="jobsearch-JobInfoHeader-title"]');
      if (titleElem) title = titleElem.innerText;
    }
    
    if (!company) {
      const companyElem = document.querySelector('.company-name, .topcard__org-name-link, [data-testid="inlineHeader-companyName"]');
      if (companyElem) company = companyElem.innerText;
    }
  }
  
  const benefits = [];
  const benefitKeywords = [
    'health insurance', 'dental', 'vision', '401k', 'retirement',
    'paid time off', 'pto', 'vacation', 'sick leave',
    'tuition reimbursement', 'education assistance', 'remote work',
    'flexible schedule', 'stock options', 'equity', 'bonus',
    'commuter benefits', 'gym membership', 'wellness', 'life insurance'
  ];
  
  const descriptionLower = description.toLowerCase();
  for (let benefit of benefitKeywords) {
    if (descriptionLower.includes(benefit)) {
      const formatted = benefit.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      if (!benefits.includes(formatted)) {
        benefits.push(formatted);
      }
    }
  }
  
  const benefitsSection = document.querySelector('#benefits');
  if (benefitsSection) {
    const benefitItems = benefitsSection.querySelectorAll('li, .css-1b5g84r');
    benefitItems.forEach(item => {
      const text = item.innerText.trim();
      if (text && text.length > 0 && text.length < 100 && !benefits.includes(text)) {
        benefits.push(text);
      }
    });
  }
  
  const requirements = [];
  const requirementPatterns = [
    { pattern: /(?:minimum qualifications|requirements?|you (?:will|must) have):?([^.]*)/i, type: 'section' },
    { pattern: /(\d+)\+?\s*years? of experience/i, type: 'experience' },
    { pattern: /(bachelor'?s?|master'?s?|degree|diploma) in? [\w\s]+/i, type: 'education' }
  ];
  
  for (let pattern of requirementPatterns) {
    const match = description.match(pattern.pattern);
    if (match && match[0]) {
      let reqText = match[0];
      if (pattern.type === 'section' && match[1]) reqText = match[1].trim();
      if (reqText.length < 200) requirements.push(reqText);
    }
  }
  
  const uniqueRequirements = [...new Set(requirements)].slice(0, 10);
  
  if (description) {
    description = description.replace(/\s+/g, ' ').trim();
    const removePhrases = ['Sign in', 'Join now', 'Show more', 'Show less', 'Apply now', 'Save job'];
    for (let phrase of removePhrases) {
      description = description.replace(new RegExp(phrase, 'gi'), '');
    }
    description = description.slice(0, 15000);
  }
  
  let domain = '';
  try {
    const urlObj = new URL(window.location.href);
    domain = urlObj.hostname.replace('www.', '');
  } catch (e) {}
  
  return { 
    description, 
    title, 
    company, 
    salary, 
    benefits,
    requirements: uniqueRequirements,
    url: window.location.href,
    location,
    postedDate,
    domain
  };
}

function checkCompensationType(description, salary) {
  const lowerDesc = description.toLowerCase();
  
  const isCommissionOnly = COMMISSION_KEYWORDS.some(kw => lowerDesc.includes(kw));
  const isEquityOnly = EQUITY_KEYWORDS.some(kw => lowerDesc.includes(kw));
  
  let salaryValue = null;
  if (salary) {
    const match = salary.match(/\$(\d+(?:\.\d+)?)/);
    if (match) salaryValue = parseFloat(match[1]);
  }
  
  return {
    isCommissionOnly,
    isEquityOnly,
    isSuspiciouslyLowPay: salaryValue !== null && salaryValue < 15,
    hasNoSalary: !salary || salary === ''
  };
}

function checkUnpaidTrial(description) {
  const lowerDesc = description.toLowerCase();
  const found = UNPAID_TRIAL_KEYWORDS.filter(kw => lowerDesc.includes(kw));
  return {
    hasUnpaidTrial: found.length > 0,
    matches: found
  };
}

function calculateMarketRateComparison(title, salary, location) {
  let normalizedTitle = (title || '').toLowerCase();
  
  let matchedRole = null;
  let matchedRate = null;
  
  for (const [role, rate] of Object.entries(MARKET_SALARIES)) {
    if (normalizedTitle.includes(role)) {
      matchedRole = role;
      matchedRate = rate;
      break;
    }
  }
  
  let salaryValue = null;
  let salaryUnit = 'hour';
  if (salary) {
    const match = salary.match(/\$(\d+(?:\.\d+)?)/);
    if (match) salaryValue = parseFloat(match[1]);
    
    if (salary.toLowerCase().includes('year') || salary.toLowerCase().includes('annually')) {
      salaryUnit = 'year';
      if (salaryValue) salaryValue = salaryValue / 2080;
    } else if (salary.toLowerCase().includes('month')) {
      salaryUnit = 'month';
      if (salaryValue) salaryValue = salaryValue / 160;
    } else if (salary.toLowerCase().includes('week')) {
      salaryUnit = 'week';
      if (salaryValue) salaryValue = salaryValue / 40;
    } else if (salary.toLowerCase().includes('day')) {
      salaryUnit = 'day';
      if (salaryValue) salaryValue = salaryValue / 8;
    }
  }
  
  let comparison = {
    hasMarketData: matchedRate !== null,
    marketRate: matchedRate,
    matchedRole: matchedRole,
    userRate: salaryValue,
    verdict: 'Unknown',
    percentageOfMarket: null
  };
  
  if (matchedRate !== null && salaryValue !== null) {
    const percentage = (salaryValue / matchedRate) * 100;
    comparison.percentageOfMarket = Math.round(percentage);
    
    if (percentage >= 80) {
      comparison.verdict = 'Competitive / Above market';
    } else if (percentage >= 60) {
      comparison.verdict = 'Slightly below market';
    } else if (percentage >= 40) {
      comparison.verdict = 'Well below market';
    } else {
      comparison.verdict = 'Significantly underpaid';
    }
  } else if (salaryValue !== null && matchedRate === null) {
    comparison.verdict = 'No market data for this role';
  } else if (salaryValue === null) {
    comparison.verdict = 'No salary listed';
  }
  
  return comparison;
}

function calculateRealBusinessScore(company, domain, description, location) {
  let score = 0;
  const signals = [];
  const descriptionLower = description.toLowerCase();
  
  if (domain && !domain.includes('gmail.com') && !domain.includes('yahoo.com') && 
      !domain.includes('hotmail.com') && !domain.includes('outlook.com') && 
      !domain.includes('aol.com') && !domain.includes('protonmail.com')) {
    score += 20;
    signals.push('Professional email domain');
  } else if (domain && domain.includes('gmail.com')) {
    signals.push('⚠️ Using free email domain (@gmail.com) - less professional');
  } else {
    score += 5;
    signals.push('Has website domain');
  }
  
  const hasAddress = descriptionLower.match(/\d{1,5}\s+\w+\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|plaza|court|ct)/i);
  if (hasAddress || location) {
    score += 15;
    signals.push('Physical location listed');
  }
  
  const hasReviews = descriptionLower.includes('glassdoor') || 
                     descriptionLower.includes('indeed reviews') ||
                     descriptionLower.includes('company reviews') ||
                     descriptionLower.includes('rated');
  if (hasReviews) {
    score += 10;
    signals.push('Mentions employee reviews');
  }
  
  const hasLegalPages = descriptionLower.includes('privacy policy') || 
                        descriptionLower.includes('terms of service') ||
                        descriptionLower.includes('legal notice') ||
                        descriptionLower.includes('data protection');
  if (hasLegalPages) {
    score += 10;
    signals.push('Has legal/trust pages');
  }
  
  const hasBusinessDetails = descriptionLower.includes('founded') ||
                             descriptionLower.includes('established') ||
                             descriptionLower.includes('headquarters') ||
                             descriptionLower.includes('office');
  if (hasBusinessDetails) {
    score += 10;
    signals.push('Provides business details');
  }
  
  const wordCount = description.split(/\s+/).length;
  if (wordCount > 500) {
    score += 10;
    signals.push('Detailed job description');
  } else if (wordCount < 100 && wordCount > 0) {
    signals.push('Very short description (may be low quality)');
  }
  
  if (descriptionLower.includes('benefit') || descriptionLower.includes('401k') || 
      descriptionLower.includes('health insurance') || descriptionLower.includes('pto')) {
    score += 15;
    signals.push('Lists employee benefits');
  }
  
  const hasContact = descriptionLower.includes('@') || 
                     descriptionLower.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (hasContact) {
    score += 10;
    signals.push('Provides contact information');
  }
  
  return {
    score: Math.min(100, score),
    signals,
    verdict: score >= 60 ? 'Verified Business' : (score >= 30 ? 'Partially Verified' : 'Unverified Business')
  };
}

function detectDeadPosting(postedDate, description) {
  const deadSignals = [];
  let daysOld = null;
  
  if (postedDate) {
    const lowerDate = postedDate.toLowerCase();
    const daysMatch = lowerDate.match(/(\d+)\s+days?/);
    const hoursMatch = lowerDate.match(/(\d+)\s+hours?/);
    const weeksMatch = lowerDate.match(/(\d+)\s+weeks?/);
    const monthsMatch = lowerDate.match(/(\d+)\s+months?/);
    
    if (daysMatch) daysOld = parseInt(daysMatch[1]);
    else if (weeksMatch) daysOld = parseInt(weeksMatch[1]) * 7;
    else if (monthsMatch) daysOld = parseInt(monthsMatch[1]) * 30;
    else if (hoursMatch && parseInt(hoursMatch[1]) < 24) daysOld = 0;
    else if (lowerDate.includes('today')) daysOld = 0;
    else if (lowerDate.includes('yesterday')) daysOld = 1;
  }
  
  if (daysOld !== null) {
    if (daysOld > 45) deadSignals.push(`Posted ${daysOld} days ago (likely dead)`);
    else if (daysOld > 30) deadSignals.push(`Posted ${daysOld} days ago (may be stale)`);
    else if (daysOld <= 7) deadSignals.push(`Fresh posting (${daysOld} days old)`);
  } else {
    deadSignals.push('Unable to determine posting age');
  }
  
  const descriptionLower = description.toLowerCase();
  if (descriptionLower.includes('repost') || descriptionLower.includes('re-post')) {
    deadSignals.push('Job appears to be reposted');
  }
  
  if (description.length < 300 && description.length > 0) {
    deadSignals.push('Very generic description (may be low effort posting)');
  }
  
  const isDead = daysOld !== null && daysOld > 45;
  
  return {
    isDead,
    isStale: daysOld !== null && daysOld > 30 && daysOld <= 45,
    isFresh: daysOld !== null && daysOld <= 7,
    daysOld,
    signals: deadSignals
  };
}

function calculateReturnOnEffortScore(jobData, compensationCheck, marketComparison, deadCheck, businessScore) {
  let responseProb = 0.5;
  
  if (deadCheck.isFresh) responseProb += 0.25;
  else if (deadCheck.isStale) responseProb -= 0.2;
  else if (deadCheck.isDead) responseProb -= 0.4;
  
  if (jobData.salary && jobData.salary !== '') responseProb += 0.15;
  else responseProb -= 0.1;
  
  if (businessScore.score >= 60) responseProb += 0.2;
  else if (businessScore.score >= 30) responseProb += 0.05;
  else responseProb -= 0.15;
  
  if (!compensationCheck.isCommissionOnly && !compensationCheck.isEquityOnly) responseProb += 0.1;
  else responseProb -= 0.3;
  
  responseProb = Math.min(0.95, Math.max(0.05, responseProb));
  
  let payFairness = 0.5;
  
  if (compensationCheck.isCommissionOnly || compensationCheck.isEquityOnly) {
    payFairness = 0;
  } else if (compensationCheck.hasUnpaidTrial) {
    payFairness = 0.1;
  } else if (marketComparison.percentageOfMarket !== null) {
    if (marketComparison.percentageOfMarket >= 80) payFairness = 1.0;
    else if (marketComparison.percentageOfMarket >= 60) payFairness = 0.7;
    else if (marketComparison.percentageOfMarket >= 40) payFairness = 0.4;
    else payFairness = 0.2;
  } else if (!jobData.salary) {
    payFairness = 0.3;
  }
  
  const rawScore = (responseProb * 0.6 + payFairness * 0.4) * 100;
  return {
    score: Math.min(100, Math.max(0, Math.round(rawScore))),
    responseProbability: Math.round(responseProb * 100),
    payFairnessScore: Math.round(payFairness * 100)
  };
}

function highlightOnPage(results) {
  removeHighlights();
  
  const redFlags = [...RED_FLAGS];
  const greenFlags = [...GREEN_FLAGS];
  
  redFlags.forEach(flag => highlightText(flag, 'jv-highlight-red'));
  greenFlags.forEach(flag => highlightText(flag, 'jv-highlight-green'));
  highlightSalaryNumbers();
}

function highlightText(searchText, className) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentElement && 
            (node.parentElement.tagName === 'SCRIPT' || 
             node.parentElement.tagName === 'STYLE' ||
             node.parentElement.classList?.contains?.('jv-highlight-red') ||
             node.parentElement.classList?.contains?.('jv-highlight-green'))) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }
  
  textNodes.forEach(node => {
    if (node.textContent && node.textContent.toLowerCase().includes(searchText.toLowerCase())) {
      const span = document.createElement('span');
      span.className = className;
      span.innerHTML = node.textContent;
      node.parentNode.replaceChild(span, node);
    }
  });
}

function highlightSalaryNumbers() {
  const salaryPattern = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:-?\s*\$?\d{1,3}(?:,\d{3})*)?(?:\s*(?:an?|per)\s*(?:hour|hr|day|week|month|year))?/gi;
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentElement && 
            (node.parentElement.tagName === 'SCRIPT' || 
             node.parentElement.tagName === 'STYLE')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent && salaryPattern.test(node.textContent)) {
      salaryPattern.lastIndex = 0;
      const span = document.createElement('span');
      span.className = 'jv-highlight-green';
      span.innerHTML = node.textContent;
      node.parentNode.replaceChild(span, node);
    }
  }
}

function removeHighlights() {
  const highlights = document.querySelectorAll('.jv-highlight-red, .jv-highlight-green, .jv-highlight-yellow');
  highlights.forEach(el => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });
}