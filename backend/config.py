
WEBSITE_CONFIGS = {
    "linkedin.com": {
        "name": "LinkedIn",
        "description_selectors": [
            '.description__text .show-more-less-html__markup',
            '.show-more-less-html__markup',
            '.jobs-description',
            '[data-job-description]'
        ],
        "title_selectors": [
            '.top-card-layout__title',
            'h1',
            '[data-job-title]'
        ],
        "company_selectors": [
            '.topcard__org-name-link',
            '.company-name',
            '[data-company-name]'
        ],
        "json_pattern": r'"description":\s*{\s*"text":\s*"([^"]+)"',
        "json_fallback": True
    },
    
    "remoteok.com": {
        "name": "RemoteOK",
        "description_selectors": [
            '.expandContents .description',
            '.expandContents',
            '.job-description'
        ],
        "title_selectors": [
            'h1',
            'h2',
            '.job-title'
        ],
        "company_selectors": [
            '.companyLink h3',
            '.company h3',
            '[itemprop="name"]'
        ],
        "json_fallback": False
    },
    
    "indeed.com": {
        "name": "Indeed",
        "description_selectors": [
            '.jobsearch-JobComponent-description',
            '#jobDescriptionText',
            '.description__text'
        ],
        "title_selectors": [
            '.jobsearch-JobInfoHeader-title',
            'h1',
            '.job-title'
        ],
        "company_selectors": [
            '.jobsearch-CompanyInfoContainer .css-19qk8gi',
            '[data-company-name]',
            '.company-name'
        ],
        "json_pattern": r'"hostQueryExecutionResult":\s*({.*?})',
        "json_fallback": True
    },
    
    "weworkremotely.com": {
        "name": "WeWorkRemotely",
        "description_selectors": [
            '.listing-container',
            '#job-listing',
            '.description'
        ],
        "title_selectors": [
            '.listing-header-container h1',
            '.job-title',
            'h1'
        ],
        "company_selectors": [
            '.company',
            '.employer',
            '.listing-header-container .company'
        ],
        "json_fallback": False
    },
    
    "wellfound.com": {
        "name": "Wellfound",
        "description_selectors": [
            '.job-description',
            '[data-description]',
            '.description'
        ],
        "title_selectors": [
            '.job-title',
            'h1'
        ],
        "company_selectors": [
            '.company-name',
            '.startup-name'
        ],
        "json_fallback": False
    },
    
    "stackoverflow.com": {
        "name": "Stack Overflow",
        "description_selectors": [
            '.js-job-description',
            '.job-description',
            '.description'
        ],
        "title_selectors": [
            '.job-title',
            'h1'
        ],
        "company_selectors": [
            '.company-name',
            '.fc-black-700'
        ],
        "json_fallback": False
    }
}

def get_config(url):
    """Return config for the given URL based on domain"""
    from urllib.parse import urlparse
    domain = urlparse(url).netloc.lower()
    
    for site, config in WEBSITE_CONFIGS.items():
        if site in domain:
            return config
    
    # Default config for unknown sites
    return {
        "name": "Generic",
        "description_selectors": [
            '.job-description', '.description', '.job-details',
            '.posting-description', '.role-description'
        ],
        "title_selectors": ['h1', '.title', '.job-title'],
        "company_selectors": ['.company', '.employer', '.company-name'],
        "json_fallback": False
    }