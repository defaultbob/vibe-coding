const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = '/Users/DavidMills/Documents/workspace/Vern-Genomics/components';
const UNMATCHED_FILE = path.join(__dirname, 'unmatched_dependencies.json');

let VALID_CATEGORIES = new Set();
const nameToCategoryMap = new Map();

function buildRegistry() {
    if (!fs.existsSync(COMPONENTS_DIR)) return;

    fs.readdirSync(COMPONENTS_DIR).forEach(item => {
        if (fs.statSync(path.join(COMPONENTS_DIR, item)).isDirectory() && !item.startsWith('.')) {
            VALID_CATEGORIES.add(item);
            const categoryPath = path.join(COMPONENTS_DIR, item);
            const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.mdl'));
            files.forEach(file => {
                const name = file.replace('.mdl', '');
                // Handle parent.child.mdl
                const parts = name.split('.');
                const compName = parts[parts.length - 1];
                
                if (!nameToCategoryMap.has(compName)) {
                    nameToCategoryMap.set(compName, new Set());
                }
                nameToCategoryMap.get(compName).add(item);
                
                if (parts.length > 1) {
                    const parentName = parts[0];
                    if (!nameToCategoryMap.has(parentName)) {
                        nameToCategoryMap.set(parentName, new Set());
                    }
                    nameToCategoryMap.get(parentName).add(item);
                }
            });
        }
    });
}

function resolveName(name) {
    if (nameToCategoryMap.has(name)) {
        const cats = Array.from(nameToCategoryMap.get(name));
        return cats.map(c => `${c}.${name}`);
    }
    return [];
}

function parseMdlDependencies(mdlContent) {
    const deps = new Set();

    // Strategy 1: FQDN in single or double quotes
    const fqdnRegex = /['"]([a-zA-Z]+)\.([a-zA-Z0-9_.]+)['"]/g;
    let match;
    while ((match = fqdnRegex.exec(mdlContent)) !== null) {
        if (VALID_CATEGORIES.has(match[1])) {
            deps.add(`${match[1]}.${match[2]}`);
        }
    }

    // Strategy 2: Global Heuristic for any Vault Component name ending in __c, __v, or __sys
    const genericRefRegex = /\b([a-zA-Z0-9_]+__[cvsys]+)\b/g;
    while ((match = genericRefRegex.exec(mdlContent)) !== null) {
        resolveName(match[1]).forEach(d => deps.add(d));
    }

    // Strategy 3: Specific function blocks that might not use standard suffixes
    const listProps = [
        'available_lifecycles',
        'rendition_types',
        'relationship_types'
    ];
    listProps.forEach(prop => {
        const propRegex = new RegExp(`${prop}\\s*\\(([^)]+)\\)`, 'g');
        while ((match = propRegex.exec(mdlContent)) !== null) {
            const items = match[1].match(/['"]([^'"]+)['"]/g);
            if (items) {
                items.forEach(item => {
                    const cleanItem = item.replace(/['"]/g, '');
                    resolveName(cleanItem).forEach(d => deps.add(d));
                });
            }
        }
    });

    const stringProps = [
        'object_class',
        'security_tree_object',
        'target_object',
        'object',
        'destination_lifecycle',
        'lookup_relationship_name',
        'lookup_source_field'
    ];
    stringProps.forEach(prop => {
        const propRegex = new RegExp(`${prop}\\s*\\(\\s*'([^']+)'\\s*\\)`, 'g');
        while ((match = propRegex.exec(mdlContent)) !== null) {
            const val = match[1];
            if (val !== 'base') {
                resolveName(val).forEach(d => deps.add(d));
            }
        }
    });

    // Special case for destination_state('obj.lifecycle.state')
    const destStateRegex = /destination_state\s*\(\s*'([^']+)'\s*\)/g;
    while ((match = destStateRegex.exec(mdlContent)) !== null) {
        const parts = match[1].split('.');
        parts.forEach(part => {
            resolveName(part).forEach(d => deps.add(d));
        });
    }

    return Array.from(deps);
}

function parseDFileDependencies(dFilePath) {
    const deps = new Set();
    const content = fs.readFileSync(dFilePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach(line => {
        const match = line.match(/^depends_on:\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_.]+)/);
        if (match) {
            deps.add(`${match[1]}.${match[2]}`);
        }
    });
    return Array.from(deps);
}

function runTraining() {
    buildRegistry();
    
    const unmatched = [];
    let totalDFiles = 0;
    let totalDFileDependencies = 0;
    let totalUnmatched = 0;

    VALID_CATEGORIES.forEach(category => {
        const categoryPath = path.join(COMPONENTS_DIR, category);
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.mdl'));
        
        files.forEach(file => {
            const mdlFilePath = path.join(categoryPath, file);
            const dFilePath = mdlFilePath.replace(/\.mdl$/, '.d');
            
            if (fs.existsSync(dFilePath)) {
                totalDFiles++;
                const dDeps = parseDFileDependencies(dFilePath);
                totalDFileDependencies += dDeps.length;

                const mdlContent = fs.readFileSync(mdlFilePath, 'utf8');
                const parsedDeps = new Set(parseMdlDependencies(mdlContent));
                
                // Parent from file name
                const nameParts = file.replace('.mdl', '').split('.');
                if (nameParts.length > 1) {
                    parsedDeps.add(`${category}.${nameParts[0]}`);
                }

                const missing = [];
                dDeps.forEach(expectedDep => {
                    if (!parsedDeps.has(expectedDep)) {
                        missing.push(expectedDep);
                    }
                });

                if (missing.length > 0) {
                    totalUnmatched += missing.length;
                    unmatched.push({
                        file: path.join(category, file),
                        missing_dependencies: missing,
                        mdl_snippet: mdlContent.substring(0, 700) + '...'
                    });
                }
            }
        });
    });

    console.log(`Training results:`);
    console.log(`Total .d files checked: ${totalDFiles}`);
    console.log(`Total dependencies in .d files: ${totalDFileDependencies}`);
    console.log(`Total unmatched dependencies: ${totalUnmatched}`);

    fs.writeFileSync(UNMATCHED_FILE, JSON.stringify(unmatched, null, 2));
    console.log(`Wrote unmatched dependencies to ${UNMATCHED_FILE}`);
}

runTraining();
