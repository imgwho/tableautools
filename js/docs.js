/**
 * Tableau Documentation Generator Logic
 * Handles file parsing, markdown generation, and UI rendering
 */

// Initialize UI components
document.addEventListener('DOMContentLoaded', function () {
    if (typeof renderHeader === 'function') renderHeader('Twb_Docs');
    if (typeof renderFooter === 'function') renderFooter();
});

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultsContainer = document.getElementById('results-container');

// Event Listeners
if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/10');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/10');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/10');
        handleFiles(e.dataTransfer.files);
    });
}

// Core Logic
async function handleFiles(files) {
    if (files.length === 0) return;

    // Clear empty state if present
    const emptyState = resultsContainer.querySelector('.empty-state');
    if (emptyState) {
        resultsContainer.innerHTML = '';
    }

    showLoading();

    try {
        for (const file of files) {
            await processFile(file);
        }
        showToast(`Processed ${files.length} file(s)`, 'success');
    } catch (error) {
        console.error(error);
        showToast('Error processing files', 'error');
    } finally {
        hideLoading();
    }
}

async function processFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['twb', 'twbx'].includes(extension)) {
        showToast(`Skipped ${file.name}: Only .twb and .twbx files are supported.`, 'error');
        return;
    }

    try {
        let xmlContent;

        if (extension === 'twb') {
            xmlContent = await file.text();
        } else if (extension === 'twbx') {
            const zip = await JSZip.loadAsync(file);
            // Find the first .twb file in the archive
            const twbFileName = Object.keys(zip.files).find(f => f.endsWith('.twb'));

            if (!twbFileName) {
                throw new Error('No .twb file found in the .twbx archive');
            }

            xmlContent = await zip.file(twbFileName).async('text');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

        const workbookName = file.name;
        const markdown = generateDocumentation(xmlDoc, workbookName);

        const baseName = workbookName.replace(/\.(twb|twbx)$/, '');
        window.docData = window.docData || {};
        window.docData[baseName] = markdown;

        displayResult(baseName, markdown);

    } catch (error) {
        console.error(error);
        showToast(`Error processing ${file.name}: ${error.message}`, 'error');
    }
}

function displayResult(baseName, markdown) {
    const card = document.createElement('div');
    card.className = 'glass-card rounded-xl overflow-hidden flex flex-col';

    const header = document.createElement('div');
    header.className = 'p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between';
    header.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
            <div class="h-8 w-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-primary-600">description</span>
            </div>
            <h3 class="font-bold text-gray-900 truncate" title="${baseName}">${baseName}</h3>
        </div>
        <button onclick="downloadMarkdown('${baseName}')" 
            class="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-600 transition-colors shrink-0">
            <span class="material-symbols-outlined text-lg">download</span>
            <span>Download MD</span>
        </button>
    `;
    card.appendChild(header);

    const previewDiv = document.createElement('div');
    previewDiv.className = 'p-6 overflow-auto max-h-[600px] bg-white';
    previewDiv.innerHTML = `<div class="markdown-body">${markdownToHtml(markdown)}</div>`;
    card.appendChild(previewDiv);

    resultsContainer.appendChild(card);
}

function generateDocumentation(xmlDoc, workbookName) {
    let md = `# 🧭 Dashboard Documentation: ${workbookName}\n\n`;

    // Extract workbook structure
    const worksheets = Array.from(xmlDoc.querySelectorAll('worksheet'));
    const dashboards = Array.from(xmlDoc.querySelectorAll('dashboard'));
    const datasources = Array.from(xmlDoc.querySelectorAll('datasource[inline="true"]'))
        .filter(ds => ds.getAttribute('name') !== 'Parameters');

    // 1. Purpose (with context from actual content)
    md += `## 1. Purpose\n\n`;
    md += `> ⚠️ **Please customize this section** based on your dashboard's business objectives.\n\n`;

    // Provide intelligent hints based on actual content
    const hints = [];
    if (worksheets.length > 0) {
        hints.push(`This workbook contains ${worksheets.length} worksheet(s)`);
    }
    if (dashboards.length > 0) {
        hints.push(`${dashboards.length} dashboard(s)`);
    }
    if (datasources.length > 0) {
        const mainDs = datasources[0];
        const caption = mainDs.getAttribute('caption') || mainDs.getAttribute('name');
        hints.push(`connected to ${caption}`);
    }

    if (hints.length > 0) {
        md += `The **${workbookName}** workbook (${hints.join(', ')}).\n\n`;
    }

    // 2. Intended Audience
    md += `## 2. Intended Audience\n\n`;
    md += `> ⚠️ **Document the target audience** (e.g., Marketing Team, Sales Leadership, Executive Team)\n\n`;

    // 3. Workbook Information
    const workbook = xmlDoc.querySelector('workbook');
    if (workbook) {
        md += `## 3. Workbook Information\n\n`;
        md += `| Property | Value |\n`;
        md += `|----------|-------|\n`;
        md += `| Version | ${workbook.getAttribute('version') || 'N/A'} |\n`;
        md += `| Source Build | ${workbook.getAttribute('source-build') || 'N/A'} |\n`;
        md += `| Platform | ${workbook.getAttribute('source-platform') || 'N/A'} |\n`;
        md += `| Locale | ${workbook.getAttribute('locale') || 'N/A'} |\n\n`;
    }

    // 4. Data Sources
    // datasources already declared at the top of the function

    if (datasources.length > 0) {
        md += `## 4. Primary Data Source\n\n`;

        const mainDatasource = datasources[0];
        const caption = mainDatasource.getAttribute('caption');
        const name = mainDatasource.getAttribute('name');

        md += `**Source System:** ${caption || name}\n\n`;

        // Connection information
        const connection = mainDatasource.querySelector('connection');
        if (connection) {
            const connClass = connection.getAttribute('class');

            if (connClass === 'salesforce') {
                md += `**Data Type:** Salesforce CRM (Lead, Account, and Opportunity records)\n\n`;
                md += `**Refresh Frequency:** (To be specified - typically daily or weekly sync)\n\n`;
            } else if (connClass === 'federated') {
                md += `**Data Type:** Multiple data sources (federated connection)\n\n`;
            } else {
                md += `**Connection Type:** ${connClass}\n\n`;
            }

            // Table relationships
            const relations = mainDatasource.querySelectorAll('relation[type="join"]');
            if (relations.length > 0) {
                md += `**Integration Details:**\n`;

                const allTables = new Set();
                relations.forEach(rel => {
                    const tables = Array.from(rel.querySelectorAll('relation[type="table"]'));
                    tables.forEach(t => allTables.add(t.getAttribute('name')));
                });

                if (allTables.size > 0) {
                    md += `\nData includes information from the following tables:\n`;
                    allTables.forEach(table => {
                        md += `- ${table}\n`;
                    });
                    md += `\n`;
                }

                md += `The workbook uses `;
                const joinTypes = new Set();
                relations.forEach(rel => {
                    const joinType = rel.getAttribute('join') || 'inner';
                    joinTypes.add(joinType.toUpperCase());
                });
                md += `${Array.from(joinTypes).join(' and ')} JOIN operations to combine these data sources.\n\n`;
            }
        }
    }

    // 5. Parameters
    const parameters = xmlDoc.querySelectorAll('datasource[name="Parameters"] column[param-domain-type]');
    if (parameters.length > 0) {
        md += `## 5. Dashboard Parameters\n\n`;
        md += `The dashboard includes the following interactive parameters:\n\n`;
        md += `| Parameter Name | Data Type | Default Value |\n`;
        md += `|----------------|-----------|---------------|\n`;
        parameters.forEach(param => {
            const caption = param.getAttribute('caption') || param.getAttribute('name');
            const name = caption.replace(/^\[|\]$/g, '');
            const datatype = param.getAttribute('datatype');
            const value = param.getAttribute('value');
            md += `| ${name} | ${datatype} | ${value || 'N/A'} |\n`;
        });
        md += `\n`;
    }

    // 6. Dashboard Overview - Focus on what's actually displayed
    md += `## 6. Dashboard Overview\n\n`;

    // Function to clean filter names - remove datasource prefix and internal IDs
    const cleanFilterName = (filterColumn) => {
        if (!filterColumn) return '';

        // Remove datasource prefix like "salesforce.0hdpn6b1peofne19u9nyt0ots5d9].[Action ("
        let cleaned = filterColumn.replace(/^.*?\]\.?\[?/g, '');

        // Remove trailing brackets and parentheses info
        cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/g, '');
        cleaned = cleaned.replace(/^\[|\]$/g, '');

        // Extract field name from "Action (FieldName)" pattern
        const actionMatch = cleaned.match(/^Action\s*\(([^)]+)\)$/i);
        if (actionMatch) {
            cleaned = actionMatch[1].trim();
        }

        // Remove "none:", "tdy:", "ok:", "qk:", "nk:" etc. prefixes
        cleaned = cleaned.replace(/^(none|tdy|ok|qk|nk|yr|dy):/gi, '');

        // Handle "City,Country" pattern - split and clean each part
        if (cleaned.includes(',')) {
            const parts = cleaned.split(',').map(s => s.trim()).filter(s => s);
            return parts.join(', ');
        }

        // Remove trailing numbers that are not part of the field name
        // e.g., "Lead Source 1" -> "Lead Source" if the number seems to be a counter
        cleaned = cleaned.replace(/\s+\d+$/, '');

        return cleaned.trim();
    };

    if (dashboards.length > 0) {
        // Extract worksheets used in dashboards
        const worksheetsInDashboard = new Set();
        const worksheetUsageCount = new Map(); // Track usage count
        const worksheetMap = new Map();

        worksheets.forEach(ws => {
            worksheetMap.set(ws.getAttribute('name'), ws);
        });

        dashboards.forEach((db, dbIdx) => {
            const dbName = db.getAttribute('name');

            if (dbIdx === 0) {
                md += `**Dashboard Name:** ${dbName}\n\n`;
            } else {
                md += `### Additional Dashboard: ${dbName}\n\n`;
            }

            // Get dashboard size information
            const sizeElement = db.querySelector('size');
            if (sizeElement) {
                const minWidth = sizeElement.getAttribute('minwidth');
                const minHeight = sizeElement.getAttribute('minheight');
                const sizingMode = sizeElement.getAttribute('sizing-mode');
                if (minWidth && minHeight) {
                    md += `**Dashboard Size:** ${minWidth} x ${minHeight} px`;
                    if (sizingMode) {
                        md += ` (${sizingMode} sizing)`;
                    }
                    md += `\n\n`;
                }
            }

            // Get zones/components
            const zones = Array.from(db.querySelectorAll('zone'));

            // Separate worksheet zones from other zones
            const worksheetZones = zones.filter(z => z.getAttribute('name') && !z.getAttribute('type'));
            const filterZones = zones.filter(z => z.getAttribute('type') === 'filter');
            const parameterZones = zones.filter(z => z.getAttribute('type') === 'paramctrl');

            // Count worksheet usage
            worksheetZones.forEach(zone => {
                const wsName = zone.getAttribute('name');
                if (wsName) {
                    worksheetsInDashboard.add(wsName);
                    worksheetUsageCount.set(wsName, (worksheetUsageCount.get(wsName) || 0) + 1);
                }
            });

            // Layout structure
            md += `**Layout Structure:**\n\n`;

            if (worksheetZones.length > 0) {
                const uniqueCount = worksheetsInDashboard.size;
                const totalCount = worksheetZones.length;

                if (uniqueCount === totalCount) {
                    md += `- **Visualizations:** ${uniqueCount}\n`;
                } else {
                    md += `- **Visualizations:** ${uniqueCount} unique worksheet(s), used ${totalCount} times total\n`;
                }

                // Display unique worksheets with usage count
                let vizIndex = 1;
                worksheetsInDashboard.forEach(wsName => {
                    const count = worksheetUsageCount.get(wsName);
                    if (count > 1) {
                        md += `  ${vizIndex}. ${wsName} *(×${count})*\n`;
                    } else {
                        md += `  ${vizIndex}. ${wsName}\n`;
                    }
                    vizIndex++;
                });
                md += `\n`;  // Add extra newline after list
            }

            if (filterZones.length > 0) {
                md += `- **Filter Controls:** ${filterZones.length}\n`;
            }

            if (parameterZones.length > 0) {
                md += `- **Parameter Controls:** ${parameterZones.length}\n`;
            }

            md += `\n`;

            // Generate ASCII layout diagram (showing unique worksheets)
            md += `**Dashboard Layout Diagram:**\n\n`;
            md += `\`\`\`text\n`;

            if (worksheetsInDashboard.size > 0) {
                // Simple box representation - show unique worksheets with usage count
                md += `┌─────────────────────────────────────────────┐\n`;

                // Truncate dashboard name if too long
                const displayDbName = dbName.length > 25 ? dbName.substring(0, 22) + '...' : dbName;
                const paddedName = displayDbName.padEnd(25);
                md += `│       Dashboard: ${paddedName}       │\n`;
                md += `├─────────────────────────────────────────────┤\n`;

                // Display unique worksheets with usage count
                let vizIndex = 1;
                worksheetsInDashboard.forEach(wsName => {
                    const count = worksheetUsageCount.get(wsName);
                    const displayName = wsName.length > 30 ? wsName.substring(0, 27) + '...' : wsName;

                    if (count > 1) {
                        const nameWithCount = `${displayName} (×${count})`;
                        md += `│ [${vizIndex.toString().padStart(2)}] ${nameWithCount.padEnd(37)} │\n`;
                    } else {
                        md += `│ [${vizIndex.toString().padStart(2)}] ${displayName.padEnd(37)} │\n`;
                    }
                    vizIndex++;
                });

                md += `└─────────────────────────────────────────────┘\n`;
            }

            md += `\`\`\`\n\n`;

            md += `> 💡 *Detailed information for each visualization is provided in Section 7.*\n\n`;
        });

        // Now detail only the worksheets used in dashboard
        if (worksheetsInDashboard.size > 0) {
            md += `## 7. Visualization Details\n\n`;

            let vizIndex = 1;
            worksheetsInDashboard.forEach(wsName => {
                const ws = worksheetMap.get(wsName);
                if (!ws) return;

                md += `### ${vizIndex}. ${wsName}\n\n`;

                // Get fields used in this worksheet - limit to 5
                const fieldsUsed = Array.from(ws.querySelectorAll('column'));
                if (fieldsUsed.length > 0) {
                    const fieldNames = [];
                    fieldsUsed.forEach(col => {
                        const caption = col.getAttribute('caption') || col.getAttribute('name');
                        if (caption && fieldNames.length < 5) {
                            const cleanName = caption.replace(/^\[|\]$/g, '');
                            if (!fieldNames.includes(cleanName)) {
                                fieldNames.push(cleanName);
                            }
                        }
                    });

                    if (fieldNames.length > 0) {
                        md += `**Key Fields:** ${fieldNames.join(', ')}`;
                        const remainingCount = fieldsUsed.length - fieldNames.length;
                        if (remainingCount > 0) {
                            md += ` *(+${remainingCount} more)*`;
                        }
                        md += `\n\n`;
                    }
                }

                // Get filters - cleaned up
                const filters = Array.from(ws.querySelectorAll('filter'));
                if (filters.length > 0) {
                    const uniqueFilters = new Set();
                    filters.forEach(filter => {
                        const filterColumn = filter.getAttribute('column');
                        if (filterColumn) {
                            const cleanName = cleanFilterName(filterColumn);
                            // Only add if it's a valid field name (not empty, not a number, not internal markers)
                            if (cleanName &&
                                cleanName.trim() !== '' &&
                                isNaN(cleanName.trim()) &&
                                !cleanName.startsWith('Measure Names') &&
                                !cleanName.includes('__')) {
                                uniqueFilters.add(cleanName);
                            }
                        }
                    });

                    if (uniqueFilters.size > 0) {
                        md += `**Interactive Filters:** ${Array.from(uniqueFilters).join(', ')}\n\n`;
                    }
                }

                md += `> 💡 *Describe the visualization type (chart, map, table, etc.) and its purpose*\n\n`;
                vizIndex++;
            });
        }
    } else {
        // Fallback if no dashboard found
        md += `> ⚠️ **No dashboard found in this workbook.** The following worksheets are available:\n\n`;

        worksheets.slice(0, 5).forEach((ws, idx) => {
            const wsName = ws.getAttribute('name');
            md += `${idx + 1}. ${wsName}\n`;
        });

        if (worksheets.length > 5) {
            md += `\n*...and ${worksheets.length - 5} more worksheet(s)*\n`;
        }
        md += `\n`;
    }

    // Only show KPI section if we couldn't extract actual worksheets
    if (worksheets.length === 0 && dashboards.length === 0) {
        md += `> ⚠️ **Please document your dashboard components manually**\n\n`;
        md += `For each visualization, include:\n`;
        md += `- Chart type (bar, line, map, etc.)\n`;
        md += `- Purpose and insights provided\n`;
        md += `- Key metrics displayed\n`;
        md += `- Filters and interactivity\n\n`;
    }

    // 8. Calculated Fields and Key Fields
    const mainDatasource = datasources.find(ds => ds.querySelector('connection[class="federated"]') || ds.querySelector('connection[class="salesforce"]'));

    // Define calculatedFields at higher scope for use in recommendations
    let calculatedFields = [];

    if (mainDatasource) {
        md += `## 8. Field Reference\n\n`;

        const columns = Array.from(mainDatasource.querySelectorAll('metadata-record[class="column"]'));
        const allColumns = Array.from(mainDatasource.querySelectorAll('column'));

        // Extract calculated fields
        calculatedFields = allColumns.filter(col => col.querySelector('calculation'));

        if (calculatedFields.length > 0) {
            md += `### Calculated Fields\n\n`;
            md += `This workbook contains ${calculatedFields.length} calculated field(s):\n\n`;

            calculatedFields.forEach((col, idx) => {
                const caption = col.getAttribute('caption') || col.getAttribute('name');
                const name = caption ? caption.replace(/^\[|\]$/g, '') : 'Unnamed';
                const calculation = col.querySelector('calculation');
                let formula = calculation ? calculation.getAttribute('formula') : '';

                // Decode HTML entities in formula
                formula = formula
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&apos;/g, "'")
                    .replace(/&quot;/g, '"')
                    .replace(/&#10;/g, '\n');

                md += `#### ${idx + 1}. ${name}\n\n`;
                md += `**Formula:**\n`;
                md += `\`\`\`\n${formula}\n\`\`\`\n\n`;
            });
        }

        // Categorize regular fields - reduced to 6 samples
        const allDimensions = columns.filter(c => c.querySelector('local-type')?.textContent === 'string');
        const allMeasures = columns.filter(c => ['integer', 'real'].includes(c.querySelector('local-type')?.textContent || ''));

        const dimensions = allDimensions.slice(0, 6);
        const measures = allMeasures.slice(0, 6);

        if (dimensions.length > 0) {
            md += `### Key Dimensions\n\n`;
            md += `*Showing ${dimensions.length} of ${allDimensions.length} dimension(s)*\n\n`;
            md += `| Field Name | Remote Name | Parent Table |\n`;
            md += `|------------|-------------|-------------|\n`;
            dimensions.forEach(col => {
                const localName = col.querySelector('local-name')?.textContent || 'N/A';
                const remoteName = col.querySelector('remote-name')?.textContent || 'N/A';
                const parentName = col.querySelector('parent-name')?.textContent || 'N/A';
                md += `| ${localName} | ${remoteName} | ${parentName} |\n`;
            });
            md += `\n`;
        }

        if (measures.length > 0) {
            md += `### Key Measures\n\n`;
            md += `*Showing ${measures.length} of ${allMeasures.length} measure(s)*\n\n`;
            md += `| Field Name | Remote Name | Aggregation | Parent Table |\n`;
            md += `|------------|-------------|-------------|-------------|\n`;
            measures.forEach(col => {
                const localName = col.querySelector('local-name')?.textContent || 'N/A';
                const remoteName = col.querySelector('remote-name')?.textContent || 'N/A';
                const aggregation = col.querySelector('aggregation')?.textContent || 'N/A';
                const parentName = col.querySelector('parent-name')?.textContent || 'N/A';
                md += `| ${localName} | ${remoteName} | ${aggregation} | ${parentName} |\n`;
            });
            md += `\n`;
        }
    }

    // 9. Interactivity Features (extracted from actions)
    const actions = Array.from(xmlDoc.querySelectorAll('action'));
    if (actions.length > 0 || parameters.length > 0) {
        md += `## 9. Interactivity Features\n\n`;

        if (actions.length > 0) {
            md += `**Dashboard Actions:**\n\n`;
            actions.forEach((action, idx) => {
                const actionCaption = action.getAttribute('caption') || 'Unnamed Action';

                // Determine action type
                let actionType = 'Unknown';
                const linkElement = action.querySelector('link');
                const commandElement = action.querySelector('command');

                if (linkElement && linkElement.getAttribute('expression')?.startsWith('http')) {
                    actionType = 'URL Action';
                } else if (commandElement && commandElement.getAttribute('command') === 'tsc:tsl-filter') {
                    actionType = 'Filter Action';
                } else if (commandElement) {
                    actionType = 'Other Action';
                }

                md += `${idx + 1}. **${actionCaption}** (${actionType})\n`;
            });
            md += `\n`;
        }

        if (parameters.length > 0) {
            md += `**Interactive Parameters:** ${parameters.length} parameter(s) allow users to customize the view.\n\n`;
        }

        md += `> 💡 *Review the dashboard to document how these interactive features work together.*\n\n`;
    } else {
        md += `## 9. Interactivity Features\n\n`;
        md += `> ⚠️ **Please document interactive features** such as:\n`;
        md += `- Click-to-filter actions\n`;
        md += `- Hover tooltips and details\n`;
        md += `- Filter synchronization across views\n`;
        md += `- URL actions or navigation\n\n`;
    }

    // 10. Recommendations for Enhancement
    md += `## 10. Recommendations for Enhancement\n\n`;
    md += `> 💡 These are general best practices to consider:\n\n`;

    // Context-aware recommendations based on workbook content
    const hasDateFields = Array.from(mainDatasource?.querySelectorAll('metadata-record') || [])
        .some(rec => {
            const localType = rec.querySelector('local-type')?.textContent;
            return localType === 'date' || localType === 'datetime';
        });

    if (hasDateFields) {
        md += `✅ **Date Hierarchy:** Consider adding drill-down from year → quarter → month → day for time-based analysis\n\n`;
    }

    if (calculatedFields.length === 0) {
        md += `✅ **Calculated Fields:** Consider creating calculated fields for derived metrics or KPIs\n\n`;
    }

    if (parameters.length === 0) {
        md += `✅ **Parameters:** Add interactive parameters to let users customize thresholds or filters\n\n`;
    }

    md += `✅ **Visual Indicators:** Use color coding (green/red) or icons for quick trend recognition\n\n`;
    md += `✅ **Tooltips:** Enhance tooltips with contextual information and mini-visualizations\n\n`;
    md += `✅ **Data Freshness:** Display last updated timestamp for transparency\n\n`;
    md += `✅ **Performance:** Review extract vs live connection strategy based on data volume\n\n`;

    // 11. Metadata
    md += `## 11. Documentation Metadata\n\n`;
    md += `| Property | Value |\n`;
    md += `|----------|-------|\n`;
    md += `| Generated | ${new Date().toLocaleString()} |\n`;
    md += `| Tool | Tableau Documentation Generator |\n`;
    md += `| Source File | ${workbookName} |\n\n`;

    md += `---\n\n`;
    md += `*This documentation was automatically generated from the Tableau workbook file. `;
    md += `Please review and enhance with dashboard-specific details, screenshots, and use cases.*\n`;

    return md;
}

function markdownToHtml(markdown) {
    let html = markdown;

    // Code blocks (must be processed before other replacements)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (match, lang, code) {
        return `<pre><code class="language-${lang || 'text'}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    });

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Tables
    html = html.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.*\|\n?)*)/g, function (match, header, rows) {
        const headers = header.split('|').map(h => h.trim()).filter(h => h);
        const rowsArray = rows.trim().split('\n').map(row =>
            row.split('|').map(cell => cell.trim()).filter(cell => cell)
        );

        let table = '<table><thead><tr>';
        headers.forEach(h => table += `<th>${h}</th>`);
        table += '</tr></thead><tbody>';
        rowsArray.forEach(row => {
            table += '<tr>';
            row.forEach(cell => table += `<td>${cell}</td>`);
            table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
    });

    // Lists
    html = html.replace(/^\- (.+)$/gim, '<li>$1</li>');
    html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[123]>)/g, '$1');
    html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<table>)/g, '$1');
    html = html.replace(/(<\/table>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');

    return html;
}

function downloadMarkdown(baseName) {
    if (!window.docData || !window.docData[baseName]) return;
    const blob = new Blob([window.docData[baseName]], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_documentation.md`;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
