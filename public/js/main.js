// ==========================================================================
// Visafy - Shared Global Utilities
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation Active Link Highlighter
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        // Handle root, index, and relative tool paths
        if (currentPath === linkPath || 
           (currentPath.endsWith('/') && linkPath.includes('index.html')) ||
           (currentPath.includes(linkPath) && linkPath !== '../index.html')) {
            link.classList.add('active');
        }
    });

    // 2. Inject Global Spinner
    if (!document.querySelector('.spinner-overlay')) {
        const spinnerOverlay = document.createElement('div');
        spinnerOverlay.className = 'spinner-overlay';
        spinnerOverlay.innerHTML = `
            <div class="spinner"></div>
            <h3 style="color: var(--primary); margin-top: 1rem;" id="spinnerText">Processing...</h3>
        `;
        document.body.appendChild(spinnerOverlay);
    }

    // 3. Inject Global Toast Container
    if (!document.querySelector('.toast-container')) {
        const toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
});

// Global functions attached to window for inline access across tool pages
window.showSpinner = function(text = 'Processing...') {
    const overlay = document.querySelector('.spinner-overlay');
    if (overlay) {
        document.getElementById('spinnerText').innerText = text;
        overlay.classList.add('active');
    }
};

window.hideSpinner = function() {
    const overlay = document.querySelector('.spinner-overlay');
    if (overlay) overlay.classList.remove('active');
};

window.showToast = function(message, type = 'success') {
    const container = document.querySelector('.toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `<span style="font-size: 1.2rem;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300); // Remove from DOM after animation
    }, 3000);
};

window.formatFileSize = function(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
