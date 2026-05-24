import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urlparse
import json
import time
import random

# Create a session for persistence
session = requests.Session()

# List of user agents to rotate
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

def get_random_user_agent():
    return random.choice(USER_AGENTS)

def scrape_job(url):
    """Smart scraper that handles LinkedIn properly with JSON fallback"""
    
    # Add random delay to avoid rate limiting (1-3 seconds)
    delay = random.uniform(1, 3)
    print(f"[DEBUG] Waiting {delay:.1f} seconds before request...")
    time.sleep(delay)
    
    headers = {
        'User-Agent': get_random_user_agent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
    }
    
    try:
        response = session.get(url, headers=headers, timeout=20)
        
        if response.status_code == 403:
            print(f"[DEBUG] Got 403, retrying with different user agent...")
            time.sleep(2)
            headers['User-Agent'] = get_random_user_agent()
            response = session.get(url, headers=headers, timeout=20)
            
        if response.status_code != 200:
            return {"error": f"HTTP {response.status_code}", "full_text": "", "title": "", "company": ""}
        
        soup = BeautifulSoup(response.text, 'html.parser')
        html_text = response.text
        
        description_text = ""
        job_title = ""
        company_name = ""
        
        # ========== STRATEGY 1: HTML EXTRACTION ==========
        
        # TRY JSON-LD FIRST
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string)
                if isinstance(data, dict) and data.get('@type') == 'JobPosting':
                    description_text = data.get('description', '')
                    if description_text:
                        description_text = re.sub(r'<[^>]+>', '', description_text)
                        description_text = re.sub(r'&lt;br&gt;', '\n', description_text)
                        description_text = re.sub(r'&lt;li&gt;', '\n• ', description_text)
                        description_text = re.sub(r'&lt;/?[a-zA-Z]+&gt;', '', description_text)
                        description_text = ' '.join(description_text.split())
                    job_title = data.get('title', '')
                    if data.get('hiringOrganization') and isinstance(data.get('hiringOrganization'), dict):
                        company_name = data.get('hiringOrganization', {}).get('name', '')
                    break
            except:
                pass
        
        # EXTRACT TITLE FROM PAGE
        if not job_title:
            title_selectors = [
                '.top-card-layout__title',
                'h1',
                'title',
                '.jobsearch-JobInfoHeader-title',
                '[data-testid="jobsearch-JobInfoHeader-title"]'
            ]
            for selector in title_selectors:
                elem = soup.select_one(selector)
                if elem:
                    job_title = elem.get_text().strip()
                    if job_title and '|' not in job_title:
                        break
        
        if job_title and '| LinkedIn' in job_title:
            job_title = job_title.replace(' | LinkedIn', '')
        
        # EXTRACT COMPANY
        if not company_name:
            company_selectors = [
                '.topcard__org-name-link',
                '.company-name',
                '.job-company',
                '[data-company-name]',
                '[data-testid="inlineHeader-companyName"]',
                '.jobsearch-CompanyInfoContainer .css-19qk8gi'
            ]
            for selector in company_selectors:
                elem = soup.select_one(selector)
                if elem:
                    company_name = elem.get_text().strip()
                    if company_name:
                        break
        
        # GET DESCRIPTION FROM BODY
        if not description_text:
            desc_selectors = [
                '.jobsearch-JobComponent-description',
                '#jobDescriptionText',
                '.description__text',
                '.show-more-less-html__markup'
            ]
            for selector in desc_selectors:
                elem = soup.select_one(selector)
                if elem:
                    description_text = elem.get_text()
                    if description_text and len(description_text) > 200:
                        break
        
        if not description_text:
            body = soup.find('body')
            if body:
                description_text = body.get_text()
                description_text = ' '.join(description_text.split())
        
        # CLEAN DESCRIPTION
        if description_text:
            lines = description_text.split('\n')
            cleaned_lines = []
            skip_keywords = ['sign in', 'join now', 'cookie', 'privacy', 'user agreement', 
                           'show more', 'show less', 'similar jobs', 'people also viewed',
                           'create alert', 'get notified', 'save job', 'report job']
            
            for line in lines:
                line_lower = line.lower()
                if not any(skip in line_lower for skip in skip_keywords):
                    cleaned_lines.append(line)
            
            description_text = ' '.join(cleaned_lines)
            description_text = re.sub(r'\s+', ' ', description_text).strip()
        
        # ========== STRATEGY 2: JSON EXTRACTION (IF HTML FAILED) ==========
        if len(description_text) < 500 or not job_title or not company_name:
            print("[DEBUG] HTML extraction insufficient, trying JSON extraction...")
            
            # Try to find window._initialData (Indeed, LinkedIn)
            match = re.search(r'window\._initialData\s*=\s*({.*?});', html_text, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group(1))
                    
                    # Try Indeed path
                    job_data = data.get('body', {})
                    job_data = job_data.get('hostQueryExecutionResult', {})
                    job_data = job_data.get('data', {})
                    job_data = job_data.get('jobData', {})
                    job_data = job_data.get('results', [{}])[0]
                    job_data = job_data.get('job', {})
                    
                    if job_data:
                        if not description_text or len(description_text) < 500:
                            desc_data = job_data.get('description', {})
                            json_desc = desc_data.get('text', '')
                            if json_desc:
                                description_text = json_desc
                                print(f"[DEBUG] Got description from _initialData JSON: {len(description_text)} chars")
                        
                        if not job_title:
                            json_title = job_data.get('title', '')
                            if json_title:
                                job_title = json_title
                                print(f"[DEBUG] Got title from _initialData JSON: {job_title}")
                        
                        if not company_name:
                            employer = job_data.get('employer', {})
                            json_company = employer.get('name', '')
                            if not json_company:
                                json_company = job_data.get('sourceEmployerName', '')
                            if json_company:
                                company_name = json_company
                                print(f"[DEBUG] Got company from _initialData JSON: {company_name}")
                                
                except Exception as e:
                    print(f"[DEBUG] JSON extraction error: {e}")
            
            # If still no description, try LinkedIn's specific pattern
            if len(description_text) < 500:
                match = re.search(r'"description":\s*\{\s*"text":\s*"([^"]+)"', html_text, re.DOTALL)
                if match:
                    json_desc = match.group(1)
                    json_desc = json_desc.replace('\\n', '\n').replace('\\"', '"').replace('\\/', '/')
                    if len(json_desc) > len(description_text):
                        description_text = json_desc
                        print(f"[DEBUG] Got description from raw JSON pattern: {len(description_text)} chars")
        
        # Fallbacks
        if not job_title:
            job_title = "Unknown Position"
        
        if not company_name:
            domain = urlparse(url).netloc
            company_name = domain.replace('www.', '').split('.')[0].capitalize()
        
        print(f"[DEBUG] Title: {job_title[:50]}")
        print(f"[DEBUG] Company: {company_name}")
        print(f"[DEBUG] Description length: {len(description_text)} chars")
        
        return {
            "full_text": description_text[:15000] if description_text else "",
            "title": job_title[:200],
            "company": company_name,
            "domain": urlparse(url).netloc,
            "url": url
        }
        
    except Exception as e:
        print(f"[DEBUG] Scrape error: {str(e)}")
        return {
            "error": str(e),
            "full_text": "",
            "title": "",
            "company": "",
            "domain": "",
            "url": url
        }


def extract_salary(text):
    """Extract salary from text - handles hourly rates correctly"""
    if not text:
        return {"found": [], "numeric_values": [], "has_salary": False, "is_hourly": False}
    
    # Look for hourly range like $19-$22 an hour
    hourly_range_pattern = r'\$(\d{1,3}(?:\.\d{2})?)\s*[-–]\s*\$(\d{1,3}(?:\.\d{2})?)\s+(?:an?|per)\s+hour'
    match = re.search(hourly_range_pattern, text, re.I)
    if match:
        min_hourly = float(match.group(1))
        max_hourly = float(match.group(2))
        avg_hourly = (min_hourly + max_hourly) / 2
        return {
            "found": [f"${min_hourly}-${max_hourly}/hour"],
            "numeric_values": [avg_hourly],
            "has_salary": True,
            "is_hourly": True
        }
    
    # Look for hourly with slash like $19-$22/hour
    hourly_slash_pattern = r'\$(\d{1,3}(?:\.\d{2})?)\s*[-–]\s*\$(\d{1,3}(?:\.\d{2})?)/hour'
    match = re.search(hourly_slash_pattern, text, re.I)
    if match:
        min_hourly = float(match.group(1))
        max_hourly = float(match.group(2))
        avg_hourly = (min_hourly + max_hourly) / 2
        return {
            "found": [f"${min_hourly}-${max_hourly}/hour"],
            "numeric_values": [avg_hourly],
            "has_salary": True,
            "is_hourly": True
        }
    
    # Look for single hourly with per hour
    hourly_patterns = [
        r'\$(\d{1,3}(?:\.\d{2})?)\s+per\s+hour',
        r'\$(\d{1,3}(?:\.\d{2})?)\s*/\s*hour',
        r'\$(\d{1,3}(?:\.\d{2})?)/hour',
        r'starting wage.*?\$(\d{1,3}(?:\.\d{2})?)',
        r'wage.*?\$(\d{1,3}(?:\.\d{2})?)',
        r'rate.*?\$(\d{1,3}(?:\.\d{2})?)',
    ]
    
    for pattern in hourly_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            hourly = float(match.group(1))
            return {
                "found": [f"${hourly}/hour"],
                "numeric_values": [hourly],
                "has_salary": True,
                "is_hourly": True
            }
    
    # Look for yearly range like $50K-$70K
    yearly_range_pattern = r'\$(\d{1,3}(?:,\d{3})?)\s*[-–]\s*\$(\d{1,3}(?:,\d{3})?)\s*(?:k|K)?\s*(?:per\s*)?(?:year|annum|annually)'
    match = re.search(yearly_range_pattern, text, re.I)
    if match:
        min_sal = int(match.group(1).replace(',', ''))
        max_sal = int(match.group(2).replace(',', ''))
        if 'k' in match.group(0).lower():
            min_sal = min_sal * 1000
            max_sal = max_sal * 1000
        avg = (min_sal + max_sal) // 2
        return {
            "found": [f"${min_sal:,} - ${max_sal:,}"],
            "numeric_values": [avg],
            "has_salary": True,
            "is_hourly": False
        }
    
    # Look for yearly salary (single value)
    yearly_patterns = [
        r'\$(\d{1,3}(?:,\d{3})?)\s*(?:k|K)?\s*(?:per\s*)?(?:year|annum|annually)',
        r'salary.*?\$(\d{1,3}(?:,\d{3})?)',
        r'compensation.*?\$(\d{1,3}(?:,\d{3})?)',
    ]
    
    for pattern in yearly_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            salary = int(match.group(1).replace(',', ''))
            if 'k' in pattern.lower() or ('k' in match.group(0).lower() if match else False):
                salary = salary * 1000
            return {
                "found": [f"${salary:,}"],
                "numeric_values": [salary],
                "has_salary": True,
                "is_hourly": False
            }
    
    # Look for range without per year indicator
    range_pattern = r'\$(\d{1,3}(?:,\d{3})?)\s*[-–]\s*\$(\d{1,3}(?:,\d{3})?)'
    match = re.search(range_pattern, text)
    if match:
        min_val = int(match.group(1).replace(',', ''))
        max_val = int(match.group(2).replace(',', ''))
        avg = (min_val + max_val) // 2
        if avg < 100:
            return {
                "found": [f"${min_val}-${max_val}/hour"],
                "numeric_values": [avg],
                "has_salary": True,
                "is_hourly": True
            }
        else:
            return {
                "found": [f"${min_val:,} - ${max_val:,}"],
                "numeric_values": [avg],
                "has_salary": True,
                "is_hourly": False
            }
    
    # Generic dollar amount - look for hourly context
    dollar_pattern = r'\$(\d{1,3}(?:,\d{3})?)'
    matches = re.findall(dollar_pattern, text)
    if matches:
        values = [int(m.replace(',', '')) for m in matches]
        
        # Check if there's hourly context in the text
        hourly_context = bool(re.search(r'per hour|/hour|hourly|wage', text, re.I))
        
        if hourly_context:
            hourly_values = [v for v in values if 15 <= v <= 200]
            if hourly_values:
                return {
                    "found": [f"${v}/hour" for v in hourly_values[:3]],
                    "numeric_values": hourly_values[:3],
                    "has_salary": True,
                    "is_hourly": True
                }
        
        yearly_values = [v for v in values if 20000 <= v <= 500000]
        if yearly_values:
            return {
                "found": [f"${v:,}" for v in yearly_values[:3]],
                "numeric_values": yearly_values[:3],
                "has_salary": True,
                "is_hourly": False
            }
    
    return {"found": [], "numeric_values": [], "has_salary": False, "is_hourly": False}


def extract_red_flags(text):
    """Scam detection - expanded keywords"""
    if not text or len(text) < 100:
        return []
    
    text_lower = text.lower()
    
    scam_keywords = [
        ("pay for training", "Asks for payment for training"),
        ("upfront fee", "Asks for upfront fee"),
        ("deposit required", "Deposit required"),
        ("wire transfer", "Wire transfer request"),
        ("send money", "Asks you to send money"),
        ("guaranteed income", "Guaranteed income claims"),
        ("unlimited earning potential", "Unlimited earning potential (vague)"),
        ("be your own boss", "Be your own boss (often MLM)"),
        ("pyramid", "Pyramid scheme"),
        ("mlm", "Multi-level marketing structure"),
        ("commission only", "Commission only - no base salary"),
        ("cryptocurrency", "Cryptocurrency related"),
        ("bitcoin", "Bitcoin payment"),
        ("no experience needed", "No experience needed (may be low quality)"),
        ("work from home", "Work from home (common scam bait)"),
    ]
    
    found = []
    for keyword, message in scam_keywords:
        if keyword in text_lower:
            found.append(message)
    
    return list(set(found))


def extract_green_flags(text):
    """Good signals - expanded with more keywords"""
    if not text or len(text) < 100:
        return []
    
    text_lower = text.lower()
    
    good_keywords = [
        ("health insurance", "Health insurance"),
        ("dental", "Dental insurance"),
        ("vision", "Vision insurance"),
        ("401k", "401(k) retirement plan"),
        ("retirement plan", "Retirement plan"),
        ("remote work", "Remote work allowed"),
        ("flexible hours", "Flexible hours"),
        ("equity", "Equity/stock options"),
        ("paid time off", "Paid time off"),
        ("pto", "Paid time off"),
        ("vacation", "Paid vacation"),
        ("sick leave", "Paid sick leave"),
        ("professional development", "Professional development"),
        ("career growth", "Career growth opportunities"),
        ("mentorship", "Mentorship program"),
        ("training provided", "Training provided"),
        ("overtime", "Overtime available"),
        ("union", "Union representation"),
        ("benefits package", "Benefits package"),
        ("accommodation", "Accommodations available"),
        ("disabilities", "Inclusive hiring"),
        ("inclusive", "Inclusive hiring"),
        ("bonus", "Performance bonus"),
        ("rrsp", "Retirement savings plan"),
        ("company laptop", "Company laptop provided"),
        ("home office", "Home office stipend"),
        ("wellness", "Wellness program"),
        ("life insurance", "Life insurance"),
        ("disability", "Disability insurance"),
        ("parental leave", "Parental leave"),
        ("tuition reimbursement", "Tuition reimbursement"),
    ]
    
    found = []
    for keyword, message in good_keywords:
        if keyword in text_lower:
            found.append(message)
    
    return list(set(found))[:10]


def extract_company_info(text, company_name):
    """Company signals"""
    text_lower = text.lower() if text else ""
    return {
        "has_linkedin": "linkedin.com/company" in text_lower,
        "has_glassdoor": "glassdoor.com" in text_lower,
        "has_website": bool(re.search(r'(?:https?://)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|org|io|ca|co)', text_lower))
    }


def check_recruiter_responsiveness(text):
    """Responsiveness check"""
    if not text:
        return {"rating": "uncertain", "message": "No data", "good_signals": [], "bad_signals": []}
    
    text_lower = text.lower()
    
    good_signals = []
    bad_signals = []
    
    if "we respond to all applicants" in text_lower:
        good_signals.append("Claims to respond to all applicants")
    if "within 48 hours" in text_lower:
        good_signals.append("Fast response time mentioned")
    if "typically responds within" in text_lower:
        good_signals.append("Response time mentioned")
    if "only shortlisted candidates will be contacted" in text_lower:
        bad_signals.append("May ghost most applicants")
    if "high volume of applications" in text_lower:
        bad_signals.append("High volume - may not respond to all")
    if "do not call" in text_lower:
        bad_signals.append("Do not call - may be low responsiveness")
    
    if len(good_signals) > len(bad_signals):
        rating = "likely_responsive"
        message = "Signals suggest recruiter responsiveness"
    elif len(bad_signals) > len(good_signals):
        rating = "likely_ghosting"
        message = "Signals suggest applicants may be ghosted"
    else:
        rating = "uncertain"
        message = "Recruiter responsiveness unclear"
    
    return {
        "rating": rating,
        "message": message,
        "good_signals": good_signals,
        "bad_signals": bad_signals
    }


def check_job_legitimacy(text):
    """Legitimacy checks"""
    if not text:
        return {"score": 50, "checks": {}}
    
    text_lower = text.lower()
    
    has_requirements = len(re.findall(r'require|must have|need|qualification|minimum', text_lower)) > 2
    has_responsibilities = len(re.findall(r'responsibilities|duties|will include|day to day', text_lower)) > 1
    has_company_info = len(re.findall(r'about us|company|founded|established', text_lower)) > 0
    has_contact = bool(re.search(r'@|\d{3}[-.]?\d{3}[-.]?\d{4}', text_lower))
    
    score = ((has_requirements + has_responsibilities + has_company_info + has_contact) / 4) * 100
    
    return {
        "score": int(score),
        "checks": {
            "has_requirements": has_requirements,
            "has_responsibilities": has_responsibilities,
            "has_company_info": has_company_info,
            "has_contact": has_contact
        }
    }