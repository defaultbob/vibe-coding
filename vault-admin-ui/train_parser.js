const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = '/Users/DavidMills/Documents/workspace/Vern-Genomics/components';
const UNMATCHED_FILE = path.join(__dirname, 'unmatched_dependencies.json');

let VALID_CATEGORIES = new Set();
const nameToCategoryMap = new Map();
const inboundRelationshipMap = new Map();

function buildRegistry() {
    if (!fs.existsSync(COMPONENTS_DIR)) return;

    // Pass 1: Build basic registry
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

                // Pass 1.5: Build inbound relationship map for Objects
                if (item === 'Object') {
                    const mdlContent = fs.readFileSync(path.join(categoryPath, file), 'utf8');
                    const relRegex = /relationship_inbound_name\s*\(\s*'([^']+)'\s*\)/g;
                    let match;
                    while ((match = relRegex.exec(mdlContent)) !== null) {
                        inboundRelationshipMap.set(match[1], compName);
                    }
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
        
        // Special mapping: Applicationrole references imply a data record dependency on the application_role__v object
        if (match[1] === 'Applicationrole') {
            deps.add('Object.application_role__v');
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

    // Special case for Notification Templates
    const emailPrefRegex = /email_preferences\s*\(\s*'([^']+)'\s*\)/g;
    if ((match = emailPrefRegex.exec(mdlContent)) !== null) {
        deps.add('Picklist.email_preferences__sys');
    }

    const notifCatRegex = /notification_category\s*\(\s*'([^']+)'\s*\)/g;
    if ((match = notifCatRegex.exec(mdlContent)) !== null) {
        deps.add('Picklist.notification_category__sys');
    }

    // Special case for Jobs (owner)
    const ownerRegex = /owner\s*\(\s*'user:[^']+'\s*\)/g;
    if ((match = ownerRegex.exec(mdlContent)) !== null) {
        deps.add('Object.user__sys');
    }

    // Special case for Matchingrules (implicitly depend on User Role Setup object)
    const matchingRuleFieldRegex = /(?:user_role_fields|data_fields)\s*\(/g;
    if (matchingRuleFieldRegex.test(mdlContent)) {
        deps.add('Object.user_role_setup__v');
    }

    // Special case for Typeaction in Objecttypes pointing to Objectactions
    const typeActionRegex = /Typeaction\s+[a-zA-Z0-9_]+\s*\(\s*action\s*\(\s*'([^']+)'\s*\)/g;
    while ((match = typeActionRegex.exec(mdlContent)) !== null) {
        deps.add(`Objectaction.${match[1]}`);
    }

    // Special case for vault:relatedObject relationship="" in Page Layouts
    const relatedObjRegex = /<vault:relatedObject[^>]*relationship="([^"]+)"/g;
    while ((match = relatedObjRegex.exec(mdlContent)) !== null) {
        let relName = match[1];
        
        if (inboundRelationshipMap.has(relName)) {
            deps.add(`Object.${inboundRelationshipMap.get(relName)}`);
        } else {
            // Relationships often end with 'r' in pagelayout XML (e.g., connection_client__sysr -> connection_client__sys)
            if (relName.endsWith('r')) {
                relName = relName.slice(0, -1);
            }
            resolveName(relName).forEach(d => deps.add(d));
            
            // Handle pluralized relationships (e.g., meetingperson_joins__c -> meetingperson_join__c)
            let singularName = relName.replace(/s__([cv]|sys)$/, '__$1');
            if (singularName !== relName) {
                resolveName(singularName).forEach(d => deps.add(d));
            }
        }
    }

    // Special case for vault:field reference="related_object__vr.field_name__c" in Page Layouts
    const relatedFieldRegex = /<vault:field[^>]*reference="([^"]+)\.[^"]+"/g;
    while ((match = relatedFieldRegex.exec(mdlContent)) !== null) {
        let relName = match[1];
        if (relName.endsWith('r')) {
            relName = relName.slice(0, -1);
        }
        resolveName(relName).forEach(d => deps.add(d));
    }

    // Special case for vault:wftimeline in Page Layouts (implies dependency on user_task__v)
    if (/<vault:wftimeline\s*\/>/.test(mdlContent)) {
        deps.add('Object.user_task__v');
    }

    // Special case for Objectlifecycle components (guess object from lifecycle name)
    const lifecycleMatch = mdlContent.match(/RECREATE Objectlifecycle\s+([a-zA-Z0-9_]+)\s*\(/i);
    if (lifecycleMatch) {
        let baseName = lifecycleMatch[1];
        if (baseName === 'vault_membership_lifecycle__sys') {
            deps.add('Object.user__sys');
        } else if (baseName.endsWith('_lc__sys')) {
            let guess = baseName.replace('_lc__sys', '__sys');
            deps.add(`Object.${guess}`);
        } else {
            // Remove known lifecycle suffixes/prefixes to guess the target object
            baseName = baseName.replace(/_lifecycle__(.)/, '__$1');
            baseName = baseName.replace(/lifecycle__(.)/, '__$1');
            deps.add(`Object.${baseName}`);
        }
        
        // If it defines roles, it depends on the application_role__v object implicitly
        if (mdlContent.includes('application_role(')) {
            deps.add('Object.application_role__v');
        }
    }

    // Edge case for connection_lifecycle__sys checking object type label
    if (mdlContent.includes('Object.connection__sys.object_type__v') && mdlContent.includes('Vault to Vault')) {
        deps.add('Objecttype.connection__sys.vault_to_vault__sys');
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
