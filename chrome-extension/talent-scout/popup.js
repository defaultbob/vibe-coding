document.addEventListener('DOMContentLoaded', async () => {
    runScan();
});

document.getElementById('scanBtn').addEventListener('click', runScan);

async function runScan() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const loadingEl = document.getElementById('loading');
    const resultsEl = document.getElementById('results');
    const errorEl = document.getElementById('error-msg');

    // Reset UI
    loadingEl.classList.remove('hidden');
    resultsEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    
    if (tab.url.includes("linkedin.com")) {
        chrome.tabs.sendMessage(tab.id, {action: "scan"}, (response) => {
            // Check if script injection is needed
            if (chrome.runtime.lastError) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    files: ['content.js']
                }, () => {
                    // Retry scan after injection
                    setTimeout(() => requestScan(tab.id), 500);
                });
            } else {
                handleResponse(response);
            }
        });
    } else {
        showError("Please navigate to a LinkedIn profile.");
    }
}

function requestScan(tabId) {
    chrome.tabs.sendMessage(tabId, {action: "scan"}, handleResponse);
}

function handleResponse(data) {
    const loadingEl = document.getElementById('loading');
    const resultsEl = document.getElementById('results');
    
    loadingEl.classList.add('hidden');

    if (!data || data.error) {
        showError(data ? data.error : "Could not find experience data. Scroll down and try again.");
        return;
    }

    // Populate Data
    const gradeEl = document.getElementById('grade');
    gradeEl.textContent = data.grade;
    
    // Set color class based on first letter of grade
    gradeEl.className = `grade-${data.grade.charAt(0)}`;

    document.getElementById('score').textContent = data.score;
    document.getElementById('avg-tenure').textContent = `${data.avgTenure} yrs`;
    document.getElementById('job-count').textContent = data.jobCount;
    document.getElementById('product-focus').textContent = data.isProductHeavy ? "High" : "Low";

    resultsEl.classList.remove('hidden');
}

function showError(msg) {
    const errorEl = document.getElementById('error-msg');
    const loadingEl = document.getElementById('loading');
    loadingEl.classList.add('hidden');
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}