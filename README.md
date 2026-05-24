<h1>Remote Job Validator</h1>

<p>Remote Job Validator is a Chrome extension that helps job seekers instantly identify legitimate, high-quality job opportunities and avoid scams, ghost jobs, and low-quality postings. When a user visits a job page on Indeed or LinkedIn, the extension analyzes the posting and returns a 0-100 "Return on Effort Score" that combines response probability and pay fairness.</p>

<p>The extension detects scam keywords, commission-only traps, unpaid trial requests, stale postings, and verifies company domain credibility. Users can save promising jobs to a personal list for later reference. The tool solves the problem of wasted time applying to jobs that are fake, abandoned, or pay below-market rates.</p>

<hr>

<h2>Features</h2>
<ul>
    <li>Instant job analysis on Indeed and LinkedIn</li>
    <li>0-100 "Return on Effort Score" combining response probability and pay fairness</li>
    <li>Scam keyword detection</li>
    <li>Commission-only and equity-only role detection</li>
    <li>Unpaid trial project detection</li>
    <li>Market rate comparison using local salary database</li>
    <li>Domain age and credibility verification</li>
    <li>Dead posting alert (stale or abandoned jobs)</li>
    <li>Real Business Score based on verifiable signals</li>
    <li>Save jobs to persistent list with delete and revisit options</li>
    <li>Copy detailed report to clipboard</li>
</ul>

<hr>

<h2>Requirements</h2>

<ul>
    <li>Python 3.8</li>
    <li>Google Chrome browser</li>
    <li>Install pip</li>
    <li>Install dependencies using: <code>pip install -r requirements.txt</code></li>
</ul>

<hr>

<h2>Project Structure</h2>

<pre><code>backend/
├── analyzer.py          # Core scoring and domain verification
├── scraper.py           # HTML and JSON data extraction
├── main.py              # FastAPI backend server
└── config.py            # Website-specific selectors 

extension/
├── content.js           # Page data extraction
├── popup.html           # Extension popup UI
├── popup.js             # Popup logic and backend communication
├── sidepanel.html       # Sidepanel results display
├── sidepanel.js         # Sidepanel rendering logic
├── savedjobs.html       # Saved jobs list page
├── savedjobs.js         # Saved jobs management
├── background.js        # Service worker
├── manifest.json        # Extension configuration
└── styles.css           # Styling

README.md
requirements.txt     # Python dependencies
</code></pre>

<hr>

<h2>How to Run</h2>

<p><strong>Step 1: Start the Backend Server</strong></p>

<p>Navigate to the backend directory and run:</p>

<pre><code>cd backend
python main.py
</code></pre>

<p>The server will start on <code>http://localhost:8000</code></p>

<p><strong>Step 2: Load the Chrome Extension</strong></p>

<ol>
    <li>Open Chrome and go to <code>chrome://extensions/</code></li>
    <li>Enable "Developer mode" (toggle in top right)</li>
    <li>Click "Load unpacked"</li>
    <li>Select the <code>extension/</code> folder</li>
    <li>The extension icon will appear in your toolbar</li>
</ol>

<p><strong>Step 3: Use the Extension</strong></p>

<ol>
    <li>Navigate to a job posting on Indeed or LinkedIn</li>
    <li>Click the extension icon</li>
    <li>Click "Analyze Job"</li>
    <li>View the detailed analysis in the sidepanel</li>
    <li>Save promising jobs to your list for later</li>
</ol>

<hr>

<h2>Supported Websites</h2>

<ul>
    <li>Indeed.com</li>
    <li>LinkedIn Jobs</li>
    <li>RemoteOK.com</li>
    <li>WeWorkRemotely.com</li>
</ul>

<hr>

<h2>Output</h2>

<p>For each job analyzed, the sidepanel displays:</p>

<ul>
    <li>Overall score (0-100) with color-coded verdict</li>
    <li>Return on Effort breakdown (Response Probability + Pay Fairness)</li>
    <li>Market rate comparison</li>
    <li>Real Business Score with verification signals</li>
    <li>Summary of findings</li>
    <li>List of red flags (if any)</li>
    <li>List of green flags (if any)</li>
    <li>Company domain verification</li>
    <li>Compensation details</li>
</ul>

<p>Users can copy the full report to clipboard or save the job to a list for later reference.</p>
