from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from scraper import (
    scrape_job, extract_salary, extract_red_flags, extract_green_flags,
    extract_company_info, check_recruiter_responsiveness, check_job_legitimacy
)

import uvicorn
import re
from analyzer import check_domain_for_company, check_salary, check_job_age, calculate_final_score

app = FastAPI(title="Remote Job Validator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def analyze_text(url, title, company, description_text):
    """Shared analysis function"""
    salary_data = extract_salary(description_text)
    red_flags = extract_red_flags(description_text)
    green_flags = extract_green_flags(description_text)
    company_info = extract_company_info(description_text, company)
    responsiveness = check_recruiter_responsiveness(description_text)
    legitimacy = check_job_legitimacy(description_text)
    
    domain_check = check_domain_for_company(company, url)
    salary_check = check_salary(salary_data, description_text)
    age_check = check_job_age(description_text)
    
    final = calculate_final_score(
        domain_check, salary_check, red_flags, green_flags,
        age_check, responsiveness, legitimacy
    )
    
    verdict = final.get('verdict', 'UNKNOWN')
    score = final.get('score', 0)
    
    # Generate accurate summary based on actual data
    summary = []
    
    # Main verdict statement
    if verdict == "HIGH_QUALITY_LEGIT":
        summary.append("This looks like a legitimate, high-quality job opportunity")
    elif verdict == "LEGIT_BUT_LOW_QUALITY":
        summary.append("This job appears legitimate but has some quality concerns")
    elif verdict == "SUSPICIOUS":
        summary.append("This job has concerning signals - proceed with caution")
    else:  # LIKELY_SCAM
        if len(red_flags) == 0 and len(green_flags) > 0:
            summary.append("This job has mixed signals - proceed with caution")
        elif len(red_flags) == 0:
            summary.append("This job may be low quality - verify before applying")
        else:
            summary.append("Strong scam indicators - avoid this job")
    
    # Flag counts
    if red_flags:
        summary.append(f"{len(red_flags)} red flag(s) found")
    if green_flags:
        summary.append(f"{len(green_flags)} green flag(s) found")
    
    # Salary info
    if salary_data.get('has_salary') and salary_data.get('found'):
        salary_text = salary_data['found'][0]
        # Extract numeric value
        match = re.search(r'\$(\d+(?:\.\d+)?)', salary_text)
        if match:
            hourly = float(match.group(1))
            if hourly < 20:
                summary.append(f"Pay: ${hourly}/hour (below market rate)")
            else:
                summary.append(f"Pay: ${hourly}/hour")
    
    # Domain info if good
    if domain_check.get('good') and domain_check.get('score', 0) > 15:
        summary.append(domain_check.get('message', '').replace('✓', '').strip())
    
    # Remove duplicate entries
    summary = list(dict.fromkeys(summary))
    
    return {
        "url": url,
        "title": title,
        "company": company,
        "verdict": final.get('verdict', 'UNKNOWN'),
        "score": final.get('score', 0),
        "color": final.get('color', 'gray'),
        "emoji": "",
        "response_probability": final.get('response_probability', 50),
        "pay_fairness": final.get('pay_fairness', 50),
        "details": {
            "domain": {
                "message": domain_check.get('message', 'No data'),
                "good": domain_check.get('good', False),
                "score": domain_check.get('score', 0)
            },
            "salary": {
                "message": salary_check.get('message', 'No data'),
                "good": salary_check.get('good', False),
                "score": salary_check.get('score', 0)
            },
            "job_age": {
                "message": age_check.get('message', 'No data'),
                "good": age_check.get('good', False)
            },
            "red_flags": red_flags,
            "green_flags": green_flags,
            "responsiveness": responsiveness,
            "legitimacy": legitimacy,
            "company_signals": company_info
        },
        "salaries_found": salary_data.get('found', []),
        "summary": summary
    }


@app.post("/validate-direct")
async def validate_job_direct(request: Request):
    """Endpoint that accepts pre-extracted job data from extension"""
    
    try:
        body = await request.json()
        
        url = body.get("url", "")
        description_text = body.get("description", "")
        job_title = body.get("title", "")
        company_name = body.get("company", "")
        
        print(f"\n[DEBUG] Direct validation for: {url}")
        print(f"[DEBUG] Title: {job_title[:50] if job_title else 'None'}")
        print(f"[DEBUG] Company: {company_name}")
        print(f"[DEBUG] Description length: {len(description_text)} chars")
        
        if not description_text or len(description_text) < 100:
            print(f"[DEBUG] Description too short, falling back to scrape")
            return await validate_job_scrape(request)
        
        return await analyze_text(url, job_title, company_name, description_text)
        
    except Exception as e:
        print(f"[DEBUG] Direct validation error: {str(e)}")
        import traceback
        traceback.print_exc()
        return await validate_job_scrape(request)


@app.post("/validate")
async def validate_job_scrape(request: Request):
    """Original endpoint: scrape URL and return validation"""
    
    try:
        body = await request.json()
        url = body.get("url")
        
        if not url:
            raise HTTPException(status_code=400, detail="Missing 'url' field")
        
        url = str(url).strip()
        print(f"\n[DEBUG] Scraping: {url}")
        
        scraped = scrape_job(url)
        
        if "error" in scraped and scraped["error"]:
            raise HTTPException(status_code=400, detail=f"Failed to scrape: {scraped['error']}")
        
        text = scraped.get('full_text', '')
        title = scraped.get('title', 'Unknown')
        company = scraped.get('company', 'Unknown')
        
        print(f"[DEBUG] Extracted text length: {len(text)} chars")
        
        if not text or len(text) < 100:
            print(f"[DEBUG] Text too short, returning basic response")
            return {
                "url": url,
                "title": title,
                "company": company,
                "verdict": "Insufficient Data",
                "score": 0,
                "color": "gray",
                "emoji": "",
                "details": {
                    "red_flags": [],
                    "green_flags": [],
                    "domain": {"message": "Could not analyze - page may be blocked or not a job posting", "good": False},
                    "salary": {"message": "Unable to extract job description", "good": False}
                },
                "salaries_found": [],
                "summary": ["Unable to extract job information. This may be due to: blocked content, not a job posting, or unsupported website format."]
            }
        
        return await analyze_text(url, title, company, text)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.get("/health")
async def health():
    return {"status": "alive"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)