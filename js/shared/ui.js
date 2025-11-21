/**
 * Shared UI Components & Logic
 * Handles Header, Footer, Toasts, and Loading states
 */

/**
 * Renders the global header
 * @param {string} activePageId - The ID of the current page to highlight
 */
function renderHeader(activePageId) {
  const headerContainer = document.getElementById('header-container');
  if (!headerContainer) return;

  const navItems = [
    { id: 'Twb_Analysis', label: 'Workbook Analyzer', url: 'index.html' },
    { id: 'Twb_Docs', label: 'Documentation', url: 'Twb_Docs.html' },
    { id: 'Tfl_Analysis', label: 'Flow Analyzer', url: 'Tfl_Analysis.html' }
  ];

  const navHtml = navItems.map(item => {
    const isActive = item.id === activePageId;
    const activeClass = isActive
      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
      : 'text-gray-600 hover:bg-gray-100';

    return `
      <a href="${item.url}" 
         class="px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeClass}">
        ${item.label}
      </a>
    `;
  }).join('');

  headerContainer.innerHTML = `
    <header class="w-full border-b border-gray-200/50 bg-white/80 backdrop-blur-md transition-all">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-black tracking-tight text-gray-900">
            Tableau Tools
          </h1>
        </div>
        
        <div class="flex items-center gap-4">
          <nav class="hidden md:flex items-center gap-2">
            ${navHtml}
          </nav>

          <div class="flex items-center gap-2">
            <!-- Mobile Menu Button -->
            <button id="mobile-menu-btn" class="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100">
              <span class="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Mobile Menu -->
      <div id="mobile-menu" class="hidden md:hidden border-t border-gray-200 bg-white px-4 py-2">
        <div class="flex flex-col gap-2">
          ${navHtml}
        </div>
      </div>
    </header>
  `;

  // Mobile Menu Logic
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }
}

/**
 * Renders the global footer
 */
function renderFooter() {
  const footerContainer = document.getElementById('footer-container');
  if (!footerContainer) return;

  const year = new Date().getFullYear();

  footerContainer.innerHTML = `
    <footer class="mt-auto border-t border-gray-200/50 bg-white/30 backdrop-blur-sm">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <span>&copy; ${year} Tableau Tools. All rights reserved.</span>
          </div>
          <div class="flex gap-6 text-sm font-medium text-gray-500">
            <a href="https://www.linkedin.com/in/cooper-wenhua-04534816a/" target="_blank" class="hover:text-primary-500 transition-colors">LinkedIn</a>
            <a href="https://github.com/imgwho" target="_blank" class="hover:text-primary-500 transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

/**
 * Shows a toast notification
 * @param {string} message - The message to display
 * @param {'success'|'error'|'info'} type - The type of toast
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  const color = type === 'success' ? 'text-green-500' : type === 'error' ? 'text-red-500' : 'text-primary-500';

  toast.innerHTML = `
    <span class="material-symbols-outlined ${color}">${icon}</span>
    <p class="text-sm font-medium text-gray-800">${message}</p>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

/**
 * Loading Overlay Logic
 */
function showLoading() {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('active');
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}
