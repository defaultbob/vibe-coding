const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const indexFile = path.join(rootDir, 'index.html');

// Read the current index.html
let html = fs.readFileSync(indexFile, 'utf8');

// The marker where the grid starts and ends
const gridStartMatch = html.match(/<div class="grid">/);
const gridEndMatch = html.match(/<\/div>\s*<\/main>/);

if (!gridStartMatch || !gridEndMatch) {
    console.error("Could not find grid bounds in index.html");
    process.exit(1);
}

const gridStart = gridStartMatch.index + gridStartMatch[0].length;
const gridEnd = gridEndMatch.index;

const gridContent = html.substring(gridStart, gridEnd);

// Regex to find existing tiles. We extract the href, tag, title, description, and SVG.
// Using [\s\S] to match across newlines.
const tileRegex = /<a href="\.\/([^/]+)\/index\.html" class="tile">[\s\S]*?<div class="tile-image">\s*(<svg[\s\S]*?<\/svg>)\s*<\/div>[\s\S]*?<div class="tile-content">\s*<span class="tag">(.*?)<\/span>\s*<h2 class="tile-title">(.*?)<\/h2>\s*<p class="tile-description">(.*?)<\/p>[\s\S]*?<\/a>/g;

let match;
const existingTiles = new Map();

while ((match = tileRegex.exec(gridContent)) !== null) {
    let dir = match[1];
    // Handle URL encoded directories (like Cross%20Domain...)
    try { dir = decodeURIComponent(dir); } catch (e) {}
    
    existingTiles.set(dir, {
        svg: match[2],
        tag: match[3],
        title: match[4],
        description: match[5]
    });
}

// Find all directories containing an index.html file
const directories = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
    .map(dirent => dirent.name)
    .filter(dir => fs.existsSync(path.join(rootDir, dir, 'index.html')));

let newGridContent = '\n';

// Default SVG for new projects
const defaultSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>`;

directories.sort().forEach((dir, index) => {
    const tileData = existingTiles.get(dir) || {
        svg: defaultSvg,
        tag: 'Project',
        title: dir.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Title Case
        description: 'An experimental Vibe Coding project.'
    };

    newGridContent += `            <!-- Project: ${tileData.title} -->
            <a href="./${encodeURIComponent(dir)}/index.html" class="tile">
                <div class="tile-image">
                    ${tileData.svg}
                </div>
                <div class="tile-content">
                    <span class="tag">${tileData.tag}</span>
                    <h2 class="tile-title">${tileData.title}</h2>
                    <p class="tile-description">${tileData.description}</p>
                    <div class="tile-footer">
                        View Project
                        <span class="arrow">→</span>
                    </div>
                </div>
            </a>\n\n`;
});

// Rebuild the HTML
const newHtml = html.substring(0, gridStart) + newGridContent + `        ` + html.substring(gridEnd);

fs.writeFileSync(indexFile, newHtml, 'utf8');
console.log(`Successfully rebuilt index.html with ${directories.length} projects.`);
