/**
 * Tableau Workbook Analyzer Logic
 * Handles file parsing, dependency analysis, and graph visualization
 */

let parsedData = {
    workbookName: '',
    fields: [],
    dependencies: [],
    dataSources: []
};

let currentMode = 'tbexport';
let sortOrder = { column: -1, ascending: true };
let cy = null; // Cytoscape instance
let currentLayout = 'dagre';

// Initialize Cytoscape extensions when page loads
document.addEventListener('DOMContentLoaded', function () {
    // Register dagre layout
    if (typeof cytoscape !== 'undefined' && typeof cytoscapeDagre !== 'undefined') {
        cytoscape.use(cytoscapeDagre);
    }

    // Initialize UI components
    if (typeof renderHeader === 'function') renderHeader('Twb_Analysis');
    if (typeof renderFooter === 'function') renderFooter();
});

// Drag & Drop
const dropzone = document.getElementById('dropzone');
if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/10');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/10');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/10');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    const fileName = file.name;
    const extension = fileName.split('.').pop().toLowerCase();

    if (!['twb', 'twbx'].includes(extension)) {
        showToast('Please upload a valid Tableau workbook file (.twb or .twbx)', 'error');
        return;
    }

    parsedData.workbookName = fileName;
    showLoading();

    try {
        let xmlContent;

        if (extension === 'twb') {
            xmlContent = await file.text();
        } else if (extension === 'twbx') {
            const zip = await JSZip.loadAsync(file);
            const twbFile = Object.keys(zip.files).find(f => f.endsWith('.twb'));
            if (!twbFile) {
                showToast('No .twb file found in the .twbx archive', 'error');
                hideLoading();
                return;
            }
            xmlContent = await zip.file(twbFile).async('text');
        }

        parseWorkbook(xmlContent);
        showToast(`Successfully parsed ${fileName}`, 'success');
    } catch (error) {
        console.error('Error processing file:', error);
        showToast('Error processing file: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function parseWorkbook(xmlContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        showToast('Error parsing XML: ' + parserError.textContent, 'error');
        return;
    }

    // Extract fields from all datasources
    const datasources = xmlDoc.querySelectorAll('datasource');
    parsedData.fields = [];
    parsedData.dataSources = [];
    const tempFields = []; // Temporary array to store all fields before deduplication

    // First pass: collect all fields
    datasources.forEach(datasource => {
        const dsName = datasource.getAttribute('name') || datasource.getAttribute('caption') || 'Unknown';
        if (dsName !== 'Parameters' && !parsedData.dataSources.includes(dsName)) {
            parsedData.dataSources.push(dsName);
        }

        const columns = datasource.querySelectorAll('column');
        columns.forEach(column => {
            const caption = column.getAttribute('caption');
            const nameAttr = column.getAttribute('name') || '';
            const displayName = caption || nameAttr;
            const fieldId = nameAttr;
            const datatype = column.getAttribute('datatype') || 'unknown';
            const role = column.getAttribute('role') || '';

            // Skip fields without proper role and caption (these are usually internal/duplicate definitions)
            if (!role && !caption) {
                return; // Skip this field
            }

            // Check if it's a calculated field
            const calculationNode = column.querySelector('calculation');
            const isCalculated = calculationNode !== null;
            const rawFormula = isCalculated ? calculationNode.getAttribute('formula') : '';

            // Determine field type
            let fieldType = role === 'dimension' ? 'Dimension' : role === 'measure' ? 'Measure' : 'Unknown';
            if (isCalculated) {
                fieldType = 'Calculated Field';
            }

            // Clean up display name - remove brackets if present
            const cleanName = displayName.replace(/^\[|\]$/g, '');

            tempFields.push({
                name: cleanName,
                dataType: datatype,
                fieldType: fieldType,
                dataSource: dsName,
                rawFormula: rawFormula,
                formula: '',
                fieldId: fieldId,
                isCalculated: isCalculated,
                hasCaption: !!caption,
                hasRole: !!role
            });
        });
    });

    // Deduplicate fields: prefer fields with caption and role over those without
    const fieldMap = new Map();
    tempFields.forEach(field => {
        const key = field.name.toLowerCase();
        const existing = fieldMap.get(key);

        if (!existing) {
            fieldMap.set(key, field);
        } else {
            // Prefer field with caption and valid role
            if (field.hasCaption && field.fieldType !== 'Unknown') {
                fieldMap.set(key, field);
            } else if (!existing.hasCaption && field.hasCaption) {
                fieldMap.set(key, field);
            } else if (existing.fieldType === 'Unknown' && field.fieldType !== 'Unknown') {
                fieldMap.set(key, field);
            }
        }
    });

    // Convert map back to array and filter out Unknown types
    parsedData.fields = Array.from(fieldMap.values()).filter(field => field.fieldType !== 'Unknown');

    // Clean up temporary properties
    parsedData.fields.forEach(field => {
        delete field.hasCaption;
        delete field.hasRole;
    });

    // Second pass: replace field IDs in formulas with captions
    replaceFormulaFieldIds();

    // Analyze dependencies
    analyzeDependencies();

    // Update UI
    renderTable();
    renderGraph();
    updateStats();
    enableExportButtons();
}

function replaceFormulaFieldIds() {
    // Create a map of field ID to caption
    const fieldIdToCaption = new Map();

    parsedData.fields.forEach(field => {
        if (field.fieldId) {
            fieldIdToCaption.set(field.fieldId, field.name);
            // Also store without brackets
            const withoutBrackets = field.fieldId.replace(/^\[|\]$/g, '');
            fieldIdToCaption.set(withoutBrackets, field.name);
        }
    });

    // Replace field IDs in formulas
    parsedData.fields.forEach(field => {
        if (field.rawFormula) {
            let formula = field.rawFormula;

            // Decode HTML entities
            formula = formula
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&apos;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&#10;/g, '\n');

            // Find all field references [...]
            const regex = /\[([^\]]+)\]/g;
            formula = formula.replace(regex, (match, fieldRef) => {
                // Try to find the caption for this field ID
                const caption = fieldIdToCaption.get(`[${fieldRef}]`) || fieldIdToCaption.get(fieldRef);
                if (caption) {
                    return `[${caption}]`;
                }
                return match; // Keep original if not found
            });

            field.formula = formula;
        }
    });
}

function analyzeDependencies() {
    parsedData.dependencies = [];
    const fieldMap = new Map();

    // Create a map of field names and IDs to fields
    parsedData.fields.forEach(field => {
        fieldMap.set(field.name, field);
        if (field.fieldId) {
            fieldMap.set(field.fieldId, field);
        }
    });

    // Find dependencies in calculated fields
    parsedData.fields.forEach(field => {
        if (field.isCalculated && field.formula) {
            // Extract field references from formula - they are in brackets [FieldName]
            const regex = /\[([^\]]+)\]/g;
            let match;
            const dependencies = new Set();

            while ((match = regex.exec(field.formula)) !== null) {
                const refName = match[1];

                // Try to find the referenced field
                let refField = fieldMap.get(refName);

                // If not found by exact match, try to find by caption
                if (!refField) {
                    refField = parsedData.fields.find(f =>
                        f.name === refName ||
                        f.fieldId === `[${refName}]` ||
                        f.fieldId.includes(refName)
                    );
                }

                if (refField && refField.name !== field.name) {
                    dependencies.add(refField.name);
                }
            }

            // Add dependencies
            dependencies.forEach(depName => {
                parsedData.dependencies.push({
                    from: depName,
                    to: field.name
                });
            });
        }
    });
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    parsedData.fields.forEach(field => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer';
        row.setAttribute('data-field-name', field.name);
        row.onclick = function () {
            highlightFieldInGraph(field.name);
        };

        // Determine display field type
        const isParameter = field.dataSource === 'Parameters';
        const displayFieldType = isParameter ? 'Parameter' : field.fieldType;

        row.innerHTML = `
      <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
        ${escapeHtml(field.name)}
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          ${escapeHtml(field.dataType)}
        </span>
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getFieldTypeColor(displayFieldType)}">
          ${escapeHtml(displayFieldType)}
        </span>
      </td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        ${escapeHtml(field.dataSource)}
      </td>
      <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title="${escapeHtml(field.formula)}">
        ${field.formula ? escapeHtml(field.formula) : '-'}
      </td>
      <td class="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 max-w-xs truncate font-mono" title="${escapeHtml(field.fieldId)}">
        ${field.fieldId ? escapeHtml(field.fieldId) : '-'}
      </td>
    `;
        tbody.appendChild(row);
    });
}

function highlightFieldInGraph(fieldName) {
    if (!cy) return;

    // Find the node
    const node = cy.getElementById(fieldName);
    if (node.length === 0) {
        // Field not in graph (no dependencies)
        showToast(`Field "${fieldName}" is not in the dependency graph`, 'info');
        return;
    }

    // Reset all
    cy.elements().removeClass('highlighted dimmed');

    // Get all connected edges and nodes (both incoming and outgoing)
    const connectedEdges = node.connectedEdges();
    const connectedNodes = connectedEdges.connectedNodes();

    // Dim everything
    cy.elements().addClass('dimmed');

    // Highlight selected node and its dependency chain
    node.removeClass('dimmed').addClass('highlighted');
    connectedEdges.removeClass('dimmed').addClass('highlighted');
    connectedNodes.removeClass('dimmed').addClass('highlighted');

    // Fit view to the highlighted subgraph
    const elementsToFit = node.union(connectedEdges).union(connectedNodes);
    cy.fit(elementsToFit, 50);

    // Scroll to graph
    document.getElementById('graph-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderGraph() {
    // Hide placeholder
    const placeholder = document.getElementById('graph-placeholder');

    if (parsedData.dependencies.length === 0) {
        placeholder.innerHTML = `
      <div class="text-center text-gray-400 dark:text-gray-500">
        <span class="material-symbols-outlined text-5xl">account_tree</span>
        <p class="mt-2 font-medium">No dependencies found</p>
        <p class="text-sm">This workbook has no calculated fields with dependencies.</p>
      </div>
    `;
        placeholder.style.display = 'flex';
        return;
    }

    placeholder.style.display = 'none';

    // Build Cytoscape elements
    const elements = [];
    const nodesInGraph = new Set();

    // Collect all nodes involved in dependencies
    parsedData.dependencies.forEach(dep => {
        nodesInGraph.add(dep.from);
        nodesInGraph.add(dep.to);
    });

    // Create node elements
    const fieldMap = new Map();
    parsedData.fields.forEach(field => {
        fieldMap.set(field.name, field);
    });

    nodesInGraph.forEach(nodeName => {
        const field = fieldMap.get(nodeName);
        if (field) {
            let nodeShape = 'roundrectangle';
            let nodeColor = '#94A3B8'; // default gray
            let borderColor = '#64748B';
            let fieldTypeClass = 'unknown';

            // Determine if it's a parameter (from Parameters datasource)
            const isParameter = field.dataSource === 'Parameters';

            if (isParameter) {
                // Purple for Parameters
                nodeColor = '#A855F7';
                borderColor = '#9333EA';
                fieldTypeClass = 'parameter';
            } else if (field.fieldType === 'Dimension') {
                // Blue for Dimensions
                nodeColor = '#3B82F6';
                borderColor = '#2563EB';
                fieldTypeClass = 'dimension';
            } else if (field.fieldType === 'Measure') {
                // Green for Measures
                nodeColor = '#10B981';
                borderColor = '#059669';
                fieldTypeClass = 'measure';
            } else if (field.fieldType === 'Calculated Field') {
                // Orange for Calculated Fields (now roundrectangle, not diamond)
                nodeColor = '#F59E0B';
                borderColor = '#D97706';
                fieldTypeClass = 'calculated-field';
            }

            elements.push({
                data: {
                    id: nodeName,
                    label: nodeName.length > 25 ? nodeName.substring(0, 22) + '...' : nodeName,
                    fullName: nodeName,
                    fieldType: isParameter ? 'Parameter' : field.fieldType,
                    dataType: field.dataType,
                    dataSource: field.dataSource,
                    formula: field.formula
                },
                classes: fieldTypeClass,
                style: {
                    'background-color': nodeColor,
                    'border-color': borderColor,
                    'shape': nodeShape
                }
            });
        }
    });

    // Create edge elements
    parsedData.dependencies.forEach(dep => {
        elements.push({
            data: {
                id: `${dep.from}-${dep.to}`,
                source: dep.from,
                target: dep.to
            }
        });
    });

    // Initialize or update Cytoscape
    if (cy) {
        cy.destroy();
    }

    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: elements,
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'color': '#fff',
                    'font-size': '12px',
                    'font-weight': 'bold',
                    'text-wrap': 'wrap',
                    'text-max-width': '120px',
                    'width': 'label',
                    'height': 'label',
                    'padding': '12px',
                    'border-width': '2px',
                    'border-opacity': 1,
                    'min-width': '60px',
                    'min-height': '40px',
                    'shape': 'roundrectangle'
                }
            },
            {
                selector: 'node.dimension',
                style: {
                    'background-color': '#3B82F6',
                    'border-color': '#2563EB'
                }
            },
            {
                selector: 'node.measure',
                style: {
                    'background-color': '#10B981',
                    'border-color': '#059669'
                }
            },
            {
                selector: 'node.calculated-field',
                style: {
                    'background-color': '#F59E0B',
                    'border-color': '#D97706'
                }
            },
            {
                selector: 'node.parameter',
                style: {
                    'background-color': '#A855F7',
                    'border-color': '#9333EA'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#94A3B8',
                    'target-arrow-color': '#94A3B8',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'arrow-scale': 1.2
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-width': '4px',
                    'border-color': '#EF4444',
                    'overlay-opacity': 0.3,
                    'overlay-color': '#EF4444'
                }
            },
            {
                selector: 'edge.highlighted',
                style: {
                    'line-color': '#EF4444',
                    'target-arrow-color': '#EF4444',
                    'width': 3
                }
            },
            {
                selector: 'node.highlighted',
                style: {
                    'border-width': '4px',
                    'border-color': '#EF4444'
                }
            },
            {
                selector: 'node.dimmed',
                style: {
                    'opacity': 0.3
                }
            },
            {
                selector: 'edge.dimmed',
                style: {
                    'opacity': 0.15
                }
            }
        ],
        layout: {
            name: currentLayout,
            rankDir: 'TB', // Top to Bottom for dagre
            nodeSep: 100,
            rankSep: 150,
            animate: true,
            animationDuration: 500
        }
    });

    // Add tooltip on hover
    cy.on('mouseover', 'node', function (evt) {
        const node = evt.target;
        const data = node.data();

        // Create tooltip
        let tooltipContent = `
      <div style="position: absolute; background: rgba(0,0,0,0.9); color: white; padding: 12px; border-radius: 8px; font-size: 12px; pointer-events: none; z-index: 1000; max-width: 300px;">
        <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${data.fullName}</div>
        <div style="margin-bottom: 4px;"><strong>Type:</strong> ${data.fieldType}</div>
        <div style="margin-bottom: 4px;"><strong>Data Type:</strong> ${data.dataType}</div>
        <div style="margin-bottom: 4px;"><strong>Source:</strong> ${data.dataSource}</div>
        ${data.formula ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);"><strong>Formula:</strong><br><code style="font-size: 11px; display: block; margin-top: 4px; white-space: pre-wrap; word-break: break-all;">${data.formula.substring(0, 200)}${data.formula.length > 200 ? '...' : ''}</code></div>` : ''}
      </div>
    `;

        const tooltip = document.createElement('div');
        tooltip.id = 'cy-tooltip';
        tooltip.innerHTML = tooltipContent;
        document.body.appendChild(tooltip);

        const updateTooltipPosition = (e) => {
            const tt = document.getElementById('cy-tooltip');
            if (tt) {
                tt.style.left = (e.pageX + 15) + 'px';
                tt.style.top = (e.pageY + 15) + 'px';
            }
        };

        document.addEventListener('mousemove', updateTooltipPosition);
        node.data('mousemoveHandler', updateTooltipPosition);
    });

    cy.on('mouseout', 'node', function (evt) {
        const tooltip = document.getElementById('cy-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
        const handler = evt.target.data('mousemoveHandler');
        if (handler) {
            document.removeEventListener('mousemove', handler);
        }
    });

    // Highlight dependencies on click
    cy.on('tap', 'node', function (evt) {
        const node = evt.target;

        // Reset all
        cy.elements().removeClass('highlighted dimmed');

        // Get connected edges and nodes
        const connected = node.connectedEdges();
        const connectedNodes = connected.connectedNodes();

        // Dim everything
        cy.elements().addClass('dimmed');

        // Highlight selected node and connected elements
        node.removeClass('dimmed').addClass('highlighted');
        connected.removeClass('dimmed').addClass('highlighted');
        connectedNodes.removeClass('dimmed').addClass('highlighted');
    });

    // Click on background to reset
    cy.on('tap', function (evt) {
        if (evt.target === cy) {
            cy.elements().removeClass('highlighted dimmed');
        }
    });

    // Enable panning and zooming
    cy.userPanningEnabled(true);
    cy.userZoomingEnabled(true);
    cy.boxSelectionEnabled(false);
}

function changeLayout(layoutName) {
    if (!cy) return;

    currentLayout = layoutName;

    let layoutOptions = {
        name: layoutName,
        animate: true,
        animationDuration: 500
    };

    // Specific options for different layouts
    if (layoutName === 'dagre') {
        layoutOptions.rankDir = 'TB'; // Top to Bottom
        layoutOptions.nodeSep = 100;
        layoutOptions.rankSep = 150;
    } else if (layoutName === 'cose') {
        // Optimized Cose parameters for better spacing
        layoutOptions.nodeRepulsion = 20000; // Increased from 8000
        layoutOptions.idealEdgeLength = 150; // Increased from 100
        layoutOptions.edgeElasticity = 100;
        layoutOptions.numIter = 2000; // More iterations for stability
        layoutOptions.gravity = 1;
        layoutOptions.nodeOverlap = 20;
    } else if (layoutName === 'breadthfirst') {
        layoutOptions.directed = true;
        layoutOptions.spacingFactor = 1.5;
    }

    const layout = cy.layout(layoutOptions);
    layout.run();
}

function searchGraph(searchTerm) {
    if (!cy) return;

    cy.elements().removeClass('highlighted dimmed');

    if (!searchTerm) return;

    const term = searchTerm.toLowerCase();
    const matchedNodes = cy.nodes().filter(node => {
        return node.data('fullName').toLowerCase().includes(term);
    });

    if (matchedNodes.length > 0) {
        // Dim everything
        cy.elements().addClass('dimmed');

        // Highlight matched nodes and their connections
        matchedNodes.forEach(node => {
            node.removeClass('dimmed').addClass('highlighted');
            const connected = node.connectedEdges();
            const connectedNodes = connected.connectedNodes();
            connected.removeClass('dimmed').addClass('highlighted');
            connectedNodes.removeClass('dimmed').addClass('highlighted');
        });

        // Fit to matched nodes
        cy.fit(matchedNodes, 50);
    }
}

function resetGraph() {
    if (!cy) return;

    cy.elements().removeClass('highlighted dimmed');
    cy.fit();
    document.getElementById('graph-search').value = '';
}

function fitGraph() {
    if (!cy) return;
    cy.fit();
}

function getFieldTypeColor(fieldType) {
    switch (fieldType) {
        case 'Dimension':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'Measure':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'Calculated Field':
            return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
        case 'Parameter':
            return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
}

function exportToPNG(scale) {
    if (!cy) {
        showToast('No graph to export', 'info');
        return;
    }

    scale = scale || 2; // Default to 2x

    // Use Cytoscape's built-in PNG export
    const pngData = cy.png({
        output: 'blob-promise',
        bg: '#f9fafb',
        full: true,
        scale: parseInt(scale)
    });

    pngData.then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = parsedData.workbookName.replace(/\.(twb|twbx)$/, `_graph_${scale}x.png`);
        a.click();
        URL.revokeObjectURL(url);
    });
}

function exportToSVG() {
    if (!cy) {
        showToast('No graph to export', 'info');
        return;
    }

    // Use html2canvas as fallback for SVG-like export
    // Since cytoscape doesn't have native SVG export without additional plugin
    const container = document.getElementById('cy');

    html2canvas(container, {
        backgroundColor: '#f9fafb',
        scale: 2
    }).then(canvas => {
        // Convert to SVG-wrapped image
        const imgData = canvas.toDataURL('image/png');
        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <image width="${canvas.width}" height="${canvas.height}" xlink:href="${imgData}"/>
</svg>`;

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = parsedData.workbookName.replace(/\.(twb|twbx)$/, '_graph.svg');
        a.click();
        URL.revokeObjectURL(url);
    });
}

// Table Filtering
function filterTable() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const tbody = document.getElementById('table-body');
    const rows = tbody.getElementsByTagName('tr');

    for (let row of rows) {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    }
}

// Table Sorting
function sortTable(columnIndex) {
    const tbody = document.getElementById('table-body');
    const rows = Array.from(tbody.getElementsByTagName('tr'));

    const isAscending = sortOrder.column === columnIndex ? !sortOrder.ascending : true;
    sortOrder.column = columnIndex;
    sortOrder.ascending = isAscending;

    rows.sort((a, b) => {
        const aText = a.cells[columnIndex].textContent.trim();
        const bText = b.cells[columnIndex].textContent.trim();

        if (aText < bText) return isAscending ? -1 : 1;
        if (aText > bText) return isAscending ? 1 : -1;
        return 0;
    });

    rows.forEach(row => tbody.appendChild(row));

    // Update header indicators
    const headers = document.querySelectorAll('.sortable');
    headers.forEach((header, idx) => {
        const text = header.textContent.replace(' ▼', '').replace(' ▲', '');
        if (idx === columnIndex) {
            header.textContent = text + (isAscending ? ' ▼' : ' ▲');
        } else {
            header.textContent = text;
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
