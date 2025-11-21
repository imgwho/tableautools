/**
 * Tableau Tools Theme Configuration
 * Defines the "Yellow Series" premium theme
 */

// Inject Material Symbols Font
(function () {
  if (!document.getElementById('material-symbols-font')) {
    const fontLink = document.createElement('link');
    fontLink.id = 'material-symbols-font';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0';
    document.head.appendChild(fontLink);
  }
})();

// Tailwind Configuration
tailwind.config = {
  theme: {
    extend: {
      colors: {
        "primary": "#f59e0b", // Amber-500
        "primary-50": "#fffbeb",
        "primary-100": "#fef3c7",
        "primary-200": "#fde68a",
        "primary-300": "#fcd34d",
        "primary-400": "#fbbf24",
        "primary-500": "#f59e0b",
        "primary-600": "#d97706",
        "primary-700": "#b45309",
        "primary-800": "#92400e",
        "primary-900": "#78350f",
        "background-light": "#ffffff",
        "background-dark": "#ffffff", // Fallback/Same as light
        "accent": "#3B82F6",
        "success": "#10B981",
        "error": "#EF4444"
      },
      fontFamily: {
        display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.5rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "glass": "0 4px 30px rgba(0, 0, 0, 0.1)",
        "glow": "0 0 15px rgba(245, 158, 11, 0.3)",
      }
    }
  }
};
