const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = '/Users/DavidMills/Documents/workspace/Vern-Genomics/components';
const OUTPUT_FILE = path.join(__dirname, 'components_data.js');
const RAW_OUTPUT_FILE = path.join(__dirname, 'components_raw.js');

function parseMdlFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Find top level definition: RECREATE or ALTER
        const topLevelMatch = content.match(/(?:RECREATE|ALTER)\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_.]+)\s*\(/i);
        if (!topLevelMatch) return null;

        const type = topLevelMatch[1];
        const name = topLevelMatch[2];

        // Extract label
        const labelMatch = content.match(/label\s*\(\s*'([^']+)'\s*\)/i);
        const label = labelMatch ? labelMatch[1] : name;

        // Extract active
        const activeMatch = content.match(/active\s*\(\s*(true|false)\s*\)/i);
        const active = activeMatch ? activeMatch[1] === 'true' : true;
        
        // Extract relationships 
        const lookupRelMatch = content.match(/lookup_relationship_name\s*\(\s*'([^']+)'\s*\)/i);
        const lookupSourceMatch = content.match(/lookup_source_field\s*\(\s*'([^']+)'\s*\)/i);
        const objectClassMatch = content.match(/object_class\s*\(\s*'([^']+)'\s*\)/i);

        const data = {
            type,
            name,
            label,
            active,
            fileName: path.basename(filePath),
            relationships: {},
            inbound: [],
            outbound: []
        };

        if (lookupRelMatch) {
            data.relationships.lookup_relationship_name = lookupRelMatch[1];
            data.outbound.push(lookupRelMatch[1]);
        }
        if (lookupSourceMatch) {
            data.relationships.lookup_source_field = lookupSourceMatch[1];
        }
        if (objectClassMatch) {
            data.relationships.object_class = objectClassMatch[1];
        }

        const lifecyclesMatch = content.match(/available_lifecycles\s*\(([^)]+)\)/i);
        if (lifecyclesMatch && lifecyclesMatch[1].trim()) {
            const lcs = lifecyclesMatch[1].match(/['"]([^'"]+)['"]/g);
            if (lcs) {
                lcs.forEach(lc => {
                    const cleanLc = lc.replace(/['"]/g, '');
                    if (cleanLc && !data.outbound.includes(cleanLc)) {
                        data.outbound.push(cleanLc);
                    }
                });
            }
        }

        // Extract fields for Objects
        if (type === 'Object') {
            const fields = [];
            const fieldRegex = /Field\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/gi;
            let match;
            while ((match = fieldRegex.exec(content)) !== null) {
                const fieldName = match[1];
                const fieldPropsStr = match[2];
                
                const fLabelMatch = fieldPropsStr.match(/label\s*\(\s*'([^']+)'\s*\)/i);
                const fTypeMatch = fieldPropsStr.match(/type\s*\(\s*'([^']+)'\s*\)/i);
                
                fields.push({
                    name: fieldName,
                    label: fLabelMatch ? fLabelMatch[1] : fieldName,
                    type: fTypeMatch ? fTypeMatch[1] : 'Unknown'
                });
                
                // Track object lookups on fields
                const fLookupMatch = fieldPropsStr.match(/lookup_relationship_name\s*\(\s*'([^']+)'\s*\)/i);
                if (fLookupMatch) {
                    if (!data.outbound.includes(fLookupMatch[1])) {
                        data.outbound.push(fLookupMatch[1]);
                    }
                }
            }
            data.fields = fields;
        }

        return { data, raw: content };
    } catch (e) {
        console.error(`Error parsing ${filePath}:`, e.message);
        return null;
    }
}

function scanDirectory() {
    const registry = {
        categories: {},
        components: [],
        categoryStats: {}
    };
    
    const rawData = {};
    const compMap = new Map();

    if (!fs.existsSync(COMPONENTS_DIR)) {
        console.error(`Directory not found: ${COMPONENTS_DIR}`);
        return { registry, rawData };
    }

    const categories = fs.readdirSync(COMPONENTS_DIR).filter(item => {
        return fs.statSync(path.join(COMPONENTS_DIR, item)).isDirectory() && !item.startsWith('.');
    });

    categories.forEach(category => {
        registry.categories[category] = [];
        registry.categoryStats[category] = { totalInbound: 0 };
        const categoryPath = path.join(COMPONENTS_DIR, category);
        
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.mdl'));
        files.forEach(file => {
            const filePath = path.join(categoryPath, file);
            const parsed = parseMdlFile(filePath);
            if (parsed) {
                const { data: compData, raw } = parsed;
                compData.category = category;
                compData.id = `${category}:${compData.name}`;
                
                // Determine parent from filename (e.g. parent.child.mdl)
                const nameParts = file.replace('.mdl', '').split('.');
                if (nameParts.length > 1) {
                    compData.parentName = nameParts[0];
                    if (!compData.outbound.includes(compData.parentName)) {
                        compData.outbound.push(compData.parentName);
                    }
                }

                registry.components.push(compData);
                registry.categories[category].push(compData.id);
                rawData[compData.id] = raw;
                if (!compMap.has(compData.name)) compMap.set(compData.name, []);
                compMap.get(compData.name).push(compData);
            }
        });
    });

    // Pass 2: Resolve Inbound Relationships
    registry.components.forEach(comp => {
        const resolvedOutbound = [];
        comp.outbound.forEach(outboundName => {
            const targets = compMap.get(outboundName);
            if (targets && targets.length > 0) {
                let targetComp = targets.find(t => ['Object', 'Doctype', 'Objectlifecycle', 'Doclifecycle', 'Lifecyclestatetype', 'Picklist'].includes(t.category));
                if (!targetComp) targetComp = targets[0];
                
                resolvedOutbound.push(targetComp.id);

                if (!targetComp.inbound.includes(comp.id)) {
                    targetComp.inbound.push(comp.id);
                    registry.categoryStats[targetComp.category].totalInbound++;
                }
            } else {
                resolvedOutbound.push(outboundName); // unresolved
            }
        });
        comp.outbound = [...new Set(resolvedOutbound)];
    });

    return { registry, rawData };
}

function build() {
    console.log('Scanning components...');
    const { registry, rawData } = scanDirectory();
    console.log(`Found ${registry.components.length} components across ${Object.keys(registry.categories).length} categories.`);
    
    // Write standard data
    const jsContent = `// Auto-generated by build_components.js\nwindow.vaultComponentsData = ${JSON.stringify(registry, null, 2)};\n`;
    fs.writeFileSync(OUTPUT_FILE, jsContent, 'utf8');
    console.log(`Generated ${OUTPUT_FILE}`);
    
    // Write raw data
    const rawJsContent = `// Auto-generated by build_components.js\nwindow.vaultRawData = ${JSON.stringify(rawData, null, 2)};\n`;
    fs.writeFileSync(RAW_OUTPUT_FILE, rawJsContent, 'utf8');
    console.log(`Generated ${RAW_OUTPUT_FILE}`);
}

build();