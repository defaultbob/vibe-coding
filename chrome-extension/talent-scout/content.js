// --- CONFIGURATION & DATA ---

const PRODUCT_COMPANIES = [
    "Google", "Alphabet", "Meta", "Facebook", "Apple", "Amazon", "Netflix", 
    "Stripe", "Airbnb", "Uber", "Lyft", "DoorDash", "Pinterest", "Snap", 
    "ByteDance", "TikTok", "Microsoft", "OpenAI", "Anthropic", "Databricks", 
    "Snowflake", "Palantir", "Figma", "Notion", "Linear", "Rippling", 
    "Coinbase", "Robinhood", "Shopify", "Spotify", "Twitch", "Discord", 
    "Slack", "Atlassian", "Salesforce", "Dropbox", "Box", "Twilio"
];

const LARGE_LEGACY_COMPANIES = [
    "IBM", "Oracle", "Cisco", "Intel", "HP", "HPE", "Dell", "Accenture", 
    "Infosys", "TCS", "Wipro", "Cognizant", "Deloitte", "PwC", "EY", "KPMG",
    "Verizon", "AT&T", "Comcast", "Boeing", "General Electric", "Ford", "GM",
    "JPMorgan Chase", "Bank of America", "Wells Fargo", "Citi", "Goldman Sachs"
];

// --- UTILITIES ---

function parseDuration(durationString) {
    if (!durationString) return 0;
    
    let years = 0;
    let months = 0;

    const yrMatch = durationString.match(/(\d+)\s+yr/);
    if (yrMatch) years = parseInt(yrMatch[1]);

    const moMatch = durationString.match(/(\d+)\s+mo/);
    if (moMatch) months = parseInt(moMatch[1]);

    return years + (months / 12);
}

function calculateGrade(experiences) {
    if (experiences.length === 0) return { grade: "N/A", score: 0, details: "No experience found" };

    let totalTenure = 0;
    let productCompanyTenure = 0;
    let shortStaysAtLargeCorps = 0;
    let jobHoppingCount = 0; 

    experiences.forEach(exp => {
        totalTenure += exp.durationYears;

        const isProduct = PRODUCT_COMPANIES.some(pc => exp.company.toLowerCase().includes(pc.toLowerCase()));
        const isLarge = LARGE_LEGACY_COMPANIES.some(lc => exp.company.toLowerCase().includes(lc.toLowerCase()));

        if (isProduct) {
            productCompanyTenure += exp.durationYears;
        }

        if (exp.durationYears < 1.2) {
            jobHoppingCount++;
            if (isLarge) {
                shortStaysAtLargeCorps++;
            }
        }
    });

    const avgTenure = totalTenure / experiences.length;
    const percentAtProduct = (productCompanyTenure / totalTenure) || 0;

    let score = 70;

    // Tenure Bonus/Penalty
    if (avgTenure >= 4) score += 15;
    else if (avgTenure >= 2.5) score += 10;
    else if (avgTenure < 1.5) score -= 15;
    else if (avgTenure < 1.0) score -= 30;

    // Quality Bonus
    score += (percentAtProduct * 20);

    // Hopping Penalty
    score -= (jobHoppingCount * 5);

    // The Specific "F" Criteria (Short stays at large companies)
    if (shortStaysAtLargeCorps > 0) {
        score -= (shortStaysAtLargeCorps * 15);
    }

    score = Math.min(100, Math.max(0, score));

    let grade = "C";
    if (score >= 97) grade = "A+";
    else if (score >= 90) grade = "A";
    else if (score >= 85) grade = "A-";
    else if (score >= 80) grade = "B+";
    else if (score >= 75) grade = "B";
    else if (score >= 70) grade = "B-";
    else if (score >= 60) grade = "C";
    else if (score >= 50) grade = "D";
    else grade = "F";

    return {
        grade,
        score: score.toFixed(1),
        avgTenure: avgTenure.toFixed(1),
        jobCount: experiences.length,
        isProductHeavy: percentAtProduct > 0.5
    };
}

// --- SCRAPING ---

function scrapeProfile() {
    const experiences = [];
    
    // Strategy: Look for pvs-list in the experience section
    const anchor = document.getElementById("experience");
    let container = null;
    
    if (anchor) {
        const section = anchor.closest('section');
        if (section) {
            const list = section.querySelector('ul.pvs-list');
            if (list) container = list;
        }
    }

    // Try finding the main profile list if ID method fails (sometimes IDs change)
    if (!container) {
        // Fallback for full page refresh where standard selectors might work better
        const allLists = document.querySelectorAll('ul.pvs-list');
        // Usually the experience list is the one with the most items or specific aria labels
        // This is a naive fallback but helps when ID finding fails
        if (allLists.length > 0) container = allLists[0]; 
    }

    if (!container) return [];

    const items = container.querySelectorAll('li.artdeco-list__item');

    items.forEach(item => {
        try {
            const textContent = item.innerText.split('\n').filter(t => t.trim().length > 0);
            
            let company = "";
            let durationStr = "";
            
            // Regex for date range or duration like "2 yrs" or "X mos"
            const durationIndex = textContent.findIndex(t => t.match(/\d+\s+(yr|mo)s?/));
            
            if (durationIndex > -1) {
                durationStr = textContent[durationIndex];
                if (durationIndex > 0) {
                    company = textContent[durationIndex - 1].split('·')[0].trim();
                } else {
                    company = textContent[0];
                }
            }

            if (company && durationStr) {
                company = company.replace(/Full-time|Part-time|Contract/g, "").trim();
                const parts = durationStr.split('·');
                const timeStr = parts.length > 1 ? parts[1].trim() : parts[0].trim();
                const years = parseDuration(timeStr);
                
                if (years > 0) {
                    experiences.push({
                        company: company,
                        durationYears: years,
                        rawDuration: timeStr
                    });
                }
            }
        } catch (e) {
            console.error("Error parsing item", e);
        }
    });

    return experiences;
}

// --- MAIN LISTENER ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scan") {
        const exps = scrapeProfile();
        if (exps.length > 0) {
            const gradeData = calculateGrade(exps);
            
            // Still inject badge for persistent view
            // (Optional: remove this if you only want popup)
            injectBadge(gradeData); 
            
            // Send data back to popup
            sendResponse(gradeData);
        } else {
            sendResponse({ error: "No experience data found on this page." });
        }
    }
    return true; // Keep channel open
});


// --- UI INJECTION (Helper) ---

function injectBadge(gradeData) {
    const existing = document.getElementById("ts-grade-badge");
    if (existing) existing.remove();

    const nameHeader = document.querySelector('h1.text-heading-xlarge');
    if (!nameHeader) return;

    const badge = document.createElement("div");
    badge.id = "ts-grade-badge";
    
    let color = "#e53935"; 
    if (gradeData.grade.startsWith("A")) color = "#43a047"; 
    else if (gradeData.grade.startsWith("B")) color = "#fdd835"; 
    else if (gradeData.grade.startsWith("C")) color = "#fb8c00"; 
    
    const textColor = gradeData.grade.startsWith("B") && !gradeData.grade.includes("-") ? "#000" : "#fff";

    badge.style.cssText = `
        display: inline-flex;
        align-items: center;
        margin-left: 10px;
        background-color: ${color};
        color: ${textColor};
        padding: 4px 12px;
        border-radius: 16px;
        font-family: sans-serif;
        font-weight: bold;
        font-size: 14px;
        cursor: pointer;
        vertical-align: middle;
    `;

    badge.innerHTML = `${gradeData.grade}`;
    badge.title = `Score: ${gradeData.score}`;
    nameHeader.appendChild(badge);
}