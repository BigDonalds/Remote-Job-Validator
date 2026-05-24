import whois
import re
import requests
from datetime import datetime
from urllib.parse import urlparse
import time

# Job board domains that should trigger company domain lookup
JOB_BOARD_DOMAINS = [
    'indeed.com', 'linkedin.com', 'remoteok.com', 'weworkremotely.com',
    'wellfound.com', 'monster.com', 'glassdoor.com', 'ziprecruiter.com',
    'careerbuilder.com', 'stackoverflow.com', 'dice.com'
]

def is_job_board_domain(domain):
    """Check if domain is a job board (not the actual employer)"""
    domain_clean = domain.replace('www.', '').lower()
    for board in JOB_BOARD_DOMAINS:
        if board in domain_clean:
            return True
    return False

def search_company_domain(company_name):
    """Search for company's official website domain"""
    if not company_name or company_name == "Unknown Position":
        return None
    
    try:
        company_clean = company_name.lower().replace(' ', '').replace('inc', '').replace('ltd', '').replace('llc', '').strip()
        
        possible_domains = [
            f"https://{company_clean}.com",
            f"https://www.{company_clean}.com",
            f"https://{company_clean}.io",
            f"https://{company_clean}.org",
            f"https://{company_clean}.ca",
            f"https://{company_clean}.co",
        ]
        
        company_with_hyphens = company_name.lower().replace(' ', '-')
        possible_domains.append(f"https://{company_with_hyphens}.com")
        
        company_no_spaces = company_name.lower().replace(' ', '')
        possible_domains.append(f"https://{company_no_spaces}.com")
        
        for domain_url in possible_domains:
            try:
                response = requests.head(domain_url, timeout=5, allow_redirects=True)
                if response.status_code < 400:
                    parsed = urlparse(domain_url)
                    domain = parsed.netloc or parsed.path
                    if domain:
                        print(f"[DEBUG] Found company domain: {domain} for {company_name}")
                        return domain
            except:
                continue
        
        return None
        
    except Exception as e:
        print(f"[DEBUG] Company domain search error: {e}")
        return None

def check_domain_for_company(company_name, original_url):
    """Check domain credibility for the actual company"""
    
    company_domain = search_company_domain(company_name)
    
    if company_domain:
        return check_domain_by_url(company_domain)
    
    original_domain = urlparse(original_url).netloc
    if not is_job_board_domain(original_domain):
        return check_domain_by_url(original_domain)
    
    return {
        "score": 0,
        "message": "Could not verify company domain - apply with caution",
        "good": False
    }

def check_domain_by_url(domain_or_url):
    """WHOIS check for a domain"""
    try:
        if domain_or_url.startswith('http'):
            domain = urlparse(domain_or_url).netloc
        else:
            domain = domain_or_url
        
        if domain.startswith('www.'):
            domain = domain[4:]
        
        domain = domain.split(':')[0]
        
        w = whois.whois(domain)
        
        creation_date = None
        if w.creation_date:
            if isinstance(w.creation_date, list):
                creation_date = w.creation_date[0]
            else:
                creation_date = w.creation_date
        
        if not creation_date:
            return {"score": 0, "message": f"Could not check domain age for {domain}", "good": False}
        
        age_days = (datetime.now() - creation_date).days
        age_years = age_days // 365
        
        if age_days < 30:
            return {"score": -30, "message": f"Company domain {domain} is only {age_days} days old (HIGH RISK)", "good": False}
        elif age_days < 90:
            return {"score": -15, "message": f"Company domain {domain} is {age_days} days old (suspicious)", "good": False}
        elif age_days < 365:
            return {"score": 5, "message": f"Company domain {domain} is {age_days//30} months old (okay)", "good": True}
        else:
            return {"score": 20, "message": f"Company domain {domain} is {age_years} years old (well-established)", "good": True}
            
    except Exception as e:
        return {"score": 0, "message": f"Could not verify company domain", "good": False}

def check_domain(url):
    """Domain credibility check"""
    return check_domain_for_company("", url)

def check_salary(salary_data, text):
    """Salary evaluation"""
    if not text:
        return {"score": -10, "message": "No job description found", "good": False}
    
    text_lower = text.lower()
    
    if "volunteer" in text_lower or "unpaid" in text_lower:
        return {"score": -40, "message": "Unpaid/volunteer role", "good": False}
    
    if not salary_data.get("has_salary", False):
        if "salary" in text_lower or "wage" in text_lower or "per hour" in text_lower:
            return {"score": -5, "message": "Salary mentioned but amount hidden", "good": False}
        return {"score": -10, "message": "No salary information provided", "good": False}
    
    numeric_values = salary_data.get("numeric_values", [])
    if not numeric_values:
        found = salary_data.get("found", [])
        if found:
            salary_text = found[0][:50]
            match = re.search(r'\$(\d+(?:\.\d+)?)', salary_text)
            if match:
                hourly_rate = float(match.group(1))
                if hourly_rate >= 20:
                    return {"score": 15, "message": f"{salary_text} (competitive rate)", "good": True}
                elif hourly_rate >= 15:
                    return {"score": 5, "message": f"{salary_text} (entry level)", "good": True}
                else:
                    return {"score": -10, "message": f"{salary_text} (below living wage)", "good": False}
            return {"score": 5, "message": salary_text, "good": True}
        return {"score": 0, "message": "Salary mentioned but unclear", "good": False}
    
    is_hourly = salary_data.get("is_hourly", False)
    highest = max(numeric_values)
    
    if is_hourly:
        if highest < 15:
            return {"score": -20, "message": f"Hourly rate ${highest}/hr (below minimum wage)", "good": False}
        elif highest < 20:
            return {"score": 5, "message": f"Hourly rate ${highest}/hr (entry level)", "good": True}
        elif highest < 35:
            return {"score": 15, "message": f"Hourly rate ${highest}/hr (competitive)", "good": True}
        else:
            return {"score": 25, "message": f"Hourly rate ${highest}/hr (top tier)", "good": True}
    else:
        if highest < 30000:
            return {"score": -20, "message": f"Salary ${highest:,} (below living wage)", "good": False}
        elif highest < 50000:
            return {"score": 5, "message": f"Salary ${highest:,} (entry level)", "good": True}
        elif highest < 80000:
            return {"score": 15, "message": f"Salary ${highest:,} (competitive)", "good": True}
        else:
            return {"score": 25, "message": f"Salary ${highest:,} (top tier)", "good": True}

def check_job_age(text):
    """Job age detection"""
    if not text:
        return {"score": 0, "message": "Could not determine job age", "good": False}
    
    text_lower = text.lower()
    
    if "reposted" in text_lower:
        return {"score": -20, "message": "Job has been reposted (ghost job likely)", "good": False}
    
    match = re.search(r'posted (\d+) days? ago', text_lower)
    if match:
        days = int(match.group(1))
        if days > 30:
            return {"score": -15, "message": f"Job posted {days} days ago (stale)", "good": False}
        elif days > 14:
            return {"score": -5, "message": f"Job posted {days} days ago", "good": True}
        else:
            return {"score": 10, "message": "Recent job posting", "good": True}
    
    match = re.search(r'posted (\d+) weeks? ago', text_lower)
    if match:
        weeks = int(match.group(1))
        if weeks > 4:
            return {"score": -10, "message": f"Job posted {weeks} weeks ago (stale)", "good": False}
        else:
            return {"score": 5, "message": f"Job posted {weeks} weeks ago", "good": True}
    
    match = re.search(r'posted (\d+) months? ago', text_lower)
    if match:
        months = int(match.group(1))
        if months > 1:
            return {"score": -15, "message": f"Job posted {months} months ago (likely dead)", "good": False}
        else:
            return {"score": 0, "message": f"Job posted {months} month ago", "good": True}
    
    return {"score": 0, "message": "Could not determine job age", "good": False}

def calculate_final_score(domain_result, salary_result, red_flags, green_flags, age_result, responsiveness_result, legitimacy_result):
    """Calculate overall score with Response Probability and Pay Fairness"""
    score = 50
    
    if isinstance(domain_result, dict):
        score += domain_result.get('score', 0)
    if isinstance(salary_result, dict):
        score += salary_result.get('score', 0)
    if isinstance(age_result, dict):
        score += age_result.get('score', 0)
    
    if isinstance(responsiveness_result, dict):
        if responsiveness_result.get('rating') == 'likely_responsive':
            score += 15
        elif responsiveness_result.get('rating') == 'likely_ghosting':
            score -= 20
    
    if isinstance(red_flags, list):
        score -= len(red_flags) * 8
    if isinstance(green_flags, list):
        score += len(green_flags) * 5
    
    final_score = max(0, min(100, int(score)))
    
    # Calculate Response Probability (0-100)
    response_probability = 50  # Base
    
    # Fresh job = higher response chance
    if isinstance(age_result, dict):
        if age_result.get('score', 0) >= 10:
            response_probability += 20
        elif age_result.get('score', 0) >= 5:
            response_probability += 10
        elif age_result.get('score', 0) <= -10:
            response_probability -= 25
    
    # Has salary = higher response chance
    if isinstance(salary_result, dict) and salary_result.get('score', 0) > 0:
        response_probability += 15
    elif isinstance(salary_result, dict) and salary_result.get('score', 0) <= -10:
        response_probability -= 10
    
    # Good domain = higher response chance
    if isinstance(domain_result, dict) and domain_result.get('score', 0) >= 15:
        response_probability += 15
    elif isinstance(domain_result, dict) and domain_result.get('score', 0) <= -15:
        response_probability -= 15
    
    # Green flags help
    if isinstance(green_flags, list):
        response_probability += min(20, len(green_flags) * 5)
    
    # Red flags hurt
    if isinstance(red_flags, list):
        response_probability -= min(30, len(red_flags) * 10)
    
    response_probability = max(5, min(95, response_probability))
    
    # Calculate Pay Fairness (0-100)
    pay_fairness = 50  # Base
    
    if isinstance(salary_result, dict):
        salary_score = salary_result.get('score', 0)
        if salary_score >= 15:
            pay_fairness = 85
        elif salary_score >= 5:
            pay_fairness = 65
        elif salary_score >= 0:
            pay_fairness = 50
        elif salary_score >= -10:
            pay_fairness = 35
        else:
            pay_fairness = 20
    
    # Penalize commission-only jobs
    if isinstance(red_flags, list):
        for flag in red_flags:
            if 'commission' in flag.lower():
                pay_fairness = 10
                break
    
    pay_fairness = max(5, min(100, pay_fairness))
    
    # Verdict mapping
    if final_score >= 80:
        verdict = "HIGH_QUALITY_LEGIT"
        color = "green"
    elif final_score >= 65:
        verdict = "LEGIT_BUT_LOW_QUALITY"
        color = "yellow"
    elif final_score >= 45:
        verdict = "SUSPICIOUS"
        color = "orange"
    else:
        verdict = "LIKELY_SCAM"
        color = "red"
    
    print(f"[DEBUG] Final score: {final_score}, Verdict: {verdict}")
    print(f"[DEBUG] Response Probability: {response_probability}%, Pay Fairness: {pay_fairness}%")
    
    return {
        "score": final_score,
        "verdict": verdict,
        "color": color,
        "emoji": "",
        "response_probability": response_probability,
        "pay_fairness": pay_fairness
    }