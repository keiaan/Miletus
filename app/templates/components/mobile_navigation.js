// Mobile navigation functionality
function initMobileNavigation() {
    const mobileNavToggle = document.getElementById('mobileNavToggle');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const sidebar = document.querySelector('nav');
    
    if (mobileNavToggle && mobileNavOverlay && sidebar) {
        mobileNavToggle.addEventListener('click', function() {
            sidebar.classList.toggle('mobile-open');
            mobileNavOverlay.classList.toggle('active');
        });
        
        mobileNavOverlay.addEventListener('click', function() {
            sidebar.classList.remove('mobile-open');
            mobileNavOverlay.classList.remove('active');
        });
        
        // Close mobile nav when clicking on nav links
        const navLinks = sidebar.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                sidebar.classList.remove('mobile-open');
                mobileNavOverlay.classList.remove('active');
            });
        });
    }
}

// Initialize mobile navigation when page loads
document.addEventListener('DOMContentLoaded', function() {
    initMobileNavigation();
});
