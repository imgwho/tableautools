/**
 * Tableau Prep Flow Analyzer Logic
 * Handles flow file parsing, JSON extraction, Mermaid diagram generation, and UI rendering
 */

// Initialize UI components
document.addEventListener('DOMContentLoaded', function () {
    if (typeof renderHeader === 'function') renderHeader('Tfl_Analysis');
    if (typeof renderFooter === 'function') renderFooter();

    // Initialize Mermaid
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
                'primaryColor': '#fada38',
                'primaryTextColor': '#1f2937',
                'primaryBorderColor': '#eab308',
                'lineColor': '#9ca3af',
                'secondaryColor': '#fffbeb',
                'tertiaryColor': '#fff'
            }
        });
    }
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
        dropZone.classList.add('border-primary-500', 'bg-primary-50');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary-500', 'bg-primary-50');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary-500', 'bg-primary-50');
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

        // Run mermaid after content is added
        if (typeof mermaid !== 'undefined') {
            await mermaid.run();
        }

        showToast(`Processed ${files.length} flow file(s)`, 'success');
    } catch (error) {
        console.error(error);
        showToast('Error processing files', 'error');
    } finally {
        hideLoading();
    }
}

function processFile(file) {
    return new Promise((resolve) => {
        const extension = file.name.split('.').pop().toLowerCase();
        if (!['tfl', 'tflx'].includes(extension)) {
            showToast(`Skipped ${file.name}: Only .tfl and .tflx files are supported.`, 'error');
            resolve();
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            JSZip.loadAsync(event.target.result)
                .then(zip => {
                    const flowFile = zip.file('flow');
                    if (flowFile) return flowFile.async('string');
                    throw new Error("'flow' file not found in archive.");
                })
                .then(content => {
                    displayResult(content, file.name);
                    resolve();
                })
                .catch(error => {
                    showToast(`Failed to process ${file.name}: ${error.message}`, 'error');
                    resolve();
                });
        };
        reader.onerror = () => {
            showToast(`Failed to read ${file.name}`, 'error');
            resolve();
        };
        reader.readAsArrayBuffer(file);
    });
}

function generateExplanation(jsonData) {
    let html = '';
    const nodes = jsonData.nodes || {};
    const getTableName = (node) => node.relation?.type === 'table' ? node.relation.table : `(Custom SQL: ${node.name})`;

    const inputs = Object.values(nodes).filter(n => n.baseType === 'input');
    if (inputs.length > 0) {
        html += '<h4 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-primary-500">input</span> Data Sources (Inputs)</h4><ul class="space-y-3 mb-6">';
        inputs.forEach(input => {
            html += `<li class="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div class="font-medium text-gray-900 mb-1">${escapeHtml(input.name)}</div>
        <div class="text-xs text-gray-500">Reading data from <code class="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-xs font-mono">${escapeHtml(getTableName(input))}</code></div>`;
            if (input.fields?.length > 0) {
                html += `<div class="mt-1 text-xs text-primary-600 font-medium">${input.fields.length} fields detected</div>`;
            }
            html += '</li>';
        });
        html += '</ul>';
    }

    const joins = Object.values(nodes).filter(n => n.nodeType?.includes('Join') && n.actionNode?.conditions);
    if (joins.length > 0) {
        html += '<h4 class="text-lg font-bold text-gray-900 mb-3 mt-6 flex items-center gap-2"><span class="material-symbols-outlined text-primary-500">join_inner</span> Data Joins</h4><ul class="space-y-3 mb-6">';
        joins.forEach(join => {
            const joinType = join.actionNode.joinType || 'unknown';
            html += `<li class="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div class="font-medium text-gray-900 mb-1">${escapeHtml(join.name)}</div>
        <div class="text-xs"><span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">${joinType.toUpperCase()} JOIN</span></div>
      </li>`;
        });
        html += '</ul>';
    }

    const outputs = Object.values(nodes).filter(n => n.baseType === 'output');
    if (outputs.length > 0) {
        html += '<h4 class="text-lg font-bold text-gray-900 mb-3 mt-6 flex items-center gap-2"><span class="material-symbols-outlined text-primary-500">output</span> Data Outputs</h4><ul class="space-y-3">';
        outputs.forEach(output => {
            html += `<li class="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div class="text-xs text-gray-500 mb-1">Publishing to:</div>
        <div class="font-medium text-gray-900 mb-1"><code class="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-xs font-mono">${escapeHtml(output.datasourceName || 'Unnamed')}</code></div>
        <div class="text-xs text-gray-500">Project: <span class="font-medium text-gray-700">${escapeHtml(output.projectName || 'Default Project')}</span></div>
      </li>`;
        });
        html += '</ul>';
    }

    return html || '<p class="text-sm text-gray-500 italic">No key summary information extracted from this flow.</p>';
}

function generateFlowchartSyntax(jsonData) {
    let mermaidSyntax = 'graph TD\n';
    const nodes = jsonData.nodes || {};
    const nodeMap = new Map(Object.entries(nodes));

    const safeId = (id) => id.replace(/-/g, '');
    const safeLabel = (label) => label ? label.replace(/"/g, '#quot;') : 'Unnamed';

    nodeMap.forEach((node, id) => {
        const id_ = safeId(id);
        const label_ = safeLabel(node.name);
        if (node.baseType === 'input') mermaidSyntax += `    ${id_}[["📥 ${label_}"]]\n`;
        else if (node.baseType === 'output') mermaidSyntax += `    ${id_}[("📤 ${label_}")]\n`;
        else if (node.nodeType?.includes('Join')) mermaidSyntax += `    ${id_}{{"🔗 ${label_}"}}\n`;
        else mermaidSyntax += `    ${id_}["⚙️ ${label_}"]\n`;
    });

    nodeMap.forEach((node, id) => {
        if (node.nextNodes) {
            node.nextNodes.forEach(nextNode => {
                mermaidSyntax += `    ${safeId(id)} --> ${safeId(nextNode.nextNodeId)}\n`;
            });
        }
    });
    return mermaidSyntax;
}

function displayResult(content, originalFileName) {
    const baseName = originalFileName.replace(/\.(tfl|tflx)$/i, '');
    const jsonFileName = `${baseName}.json`;

    // Create card container
    const card = document.createElement('div');
    card.className = 'flex flex-col gap-6 glass-card rounded-2xl p-6 animate-fade-in';

    // Card header with filename and download button
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between flex-wrap gap-4';
    header.innerHTML = `
    <div class="flex items-center gap-3 flex-grow min-w-0">
      <div class="h-10 w-10 shrink-0 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600">
        <span class="material-symbols-outlined">account_tree</span>
      </div>
      <div class="min-w-0 flex-grow">
        <h3 class="text-lg font-bold leading-tight text-gray-900 truncate">
          ${escapeHtml(jsonFileName)}
        </h3>
        <p class="text-xs text-gray-500 truncate">Analyzed from ${escapeHtml(originalFileName)}</p>
      </div>
    </div>
    <button onclick="downloadJSON('${escapeHtml(originalFileName)}')"
      class="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-white border border-gray-200 px-4 text-sm font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-primary-600">
      <span class="material-symbols-outlined text-base">download</span>
      <span class="truncate">Download JSON</span>
    </button>
  `;
    card.appendChild(header);

    let jsonObj;
    try {
        jsonObj = JSON.parse(content);
    } catch (e) {
        card.innerHTML += `
      <div class="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        <div class="flex gap-2">
          <span class="material-symbols-outlined text-base">error</span>
          <span>Unable to parse JSON format from this flow file.</span>
        </div>
      </div>`;
        resultsContainer.appendChild(card);
        return;
    }

    // Store for download
    window.flowData = window.flowData || {};
    window.flowData[originalFileName] = content;

    // Grid layout for Summary and Flowchart
    const gridDiv = document.createElement('div');
    gridDiv.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';

    // Summary section (Left column)
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'lg:col-span-1 rounded-xl border border-gray-200 bg-white/50 p-5';
    summaryDiv.innerHTML = `
    <h4 class="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Flow Summary</h4>
    ${generateExplanation(jsonObj)}
  `;
    gridDiv.appendChild(summaryDiv);

    // Mermaid flowchart section (Right 2 columns)
    const flowchartDiv = document.createElement('div');
    flowchartDiv.className = 'lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 overflow-hidden flex flex-col';
    flowchartDiv.innerHTML = `
    <h4 class="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Flow Diagram</h4>
    <div class="mermaid flex-grow flex items-center justify-center min-h-[300px]">
      ${generateFlowchartSyntax(jsonObj)}
    </div>
  `;
    gridDiv.appendChild(flowchartDiv);

    card.appendChild(gridDiv);

    // JSON viewer section (Collapsible or at bottom)
    const jsonDiv = document.createElement('div');
    jsonDiv.className = 'rounded-xl border border-gray-200 overflow-hidden bg-gray-50';

    const jsonHeader = document.createElement('div');
    jsonHeader.className = 'px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center cursor-pointer';
    jsonHeader.innerHTML = '<span class="text-xs font-bold uppercase text-gray-500">Raw JSON Data</span><span class="material-symbols-outlined text-sm">expand_more</span>';
    jsonHeader.onclick = function () {
        const content = this.nextElementSibling;
        content.classList.toggle('hidden');
        this.querySelector('.material-symbols-outlined').style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    };
    jsonDiv.appendChild(jsonHeader);

    const jsonInner = document.createElement('div');
    jsonInner.className = 'hidden overflow-x-auto h-[20rem] p-4 custom-scrollbar';
    const pre = document.createElement('pre');
    pre.className = 'm-0 text-xs';
    const code = document.createElement('code');
    code.className = 'language-json';
    code.textContent = JSON.stringify(jsonObj, null, 2);
    pre.appendChild(code);
    jsonInner.appendChild(pre);
    jsonDiv.appendChild(jsonInner);
    card.appendChild(jsonDiv);

    resultsContainer.appendChild(card);

    // Highlight code
    if (typeof Prism !== 'undefined') {
        Prism.highlightElement(code);
    }
}

function downloadJSON(fileName) {
    if (!window.flowData || !window.flowData[fileName]) return;
    const blob = new Blob([window.flowData[fileName]], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.(tfl|tflx)$/i, '.json');
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
