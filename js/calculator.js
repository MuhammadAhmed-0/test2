    // Mobile Menu Toggle Functionality
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenuPanel = document.getElementById('mobileMenuPanel');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    const mobileMenuClose = document.getElementById('mobileMenuClose');

    function openMobileMenu() {
        mobileMenuToggle.classList.add('active');
        mobileMenuPanel.classList.add('active');
        mobileMenuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        mobileMenuToggle.classList.remove('active');
        mobileMenuPanel.classList.remove('active');
        mobileMenuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    mobileMenuToggle.addEventListener('click', openMobileMenu);
    mobileMenuClose.addEventListener('click', closeMobileMenu);
    mobileMenuOverlay.addEventListener('click', closeMobileMenu);

    // Close menu when clicking on menu items
    document.querySelectorAll('.mobile-menu-items a').forEach(item => {
        item.addEventListener('click', closeMobileMenu);
    });

    // Close menu on escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mobileMenuPanel.classList.contains('active')) {
            closeMobileMenu();
        }
    });

// Search functionality
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        calculatorCards.forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            const category = card.dataset.category.toLowerCase();
            
            if (title.includes(searchTerm) || category.includes(searchTerm)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });

        // Reset active filter button
        filterButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-category="all"]').classList.add('active');
    });
}

// Filter functionality
// Filter functionality
const filterButtons = document.querySelectorAll('.filter-btn');
const calculatorCards = document.querySelectorAll('.calculator-card');
const calculatorGrid = document.querySelector('.calculator-grid');

// Create coming soon message element
const comingSoonMessage = document.createElement('div');
comingSoonMessage.className = 'coming-soon-message';
comingSoonMessage.innerHTML = `
    <div class="coming-soon-content">
        <i class="fas fa-clock"></i>
        <h3>Coming Soon</h3>
        <p>New calculators for this category are currently in development.</p>
    </div>
`;
comingSoonMessage.style.cssText = `
    display: none;
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: #666;
    background: #f8f9fa;
    border-radius: 12px;
    margin: 20px 0;
    border: 2px dashed #ddd;
`;

// Add coming soon message to grid
calculatorGrid.appendChild(comingSoonMessage);

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons
        filterButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to clicked button
        button.classList.add('active');
        
        const category = button.dataset.category;
        let visibleCount = 0;
        
        calculatorCards.forEach(card => {
            if (category === 'all' || card.dataset.category === category) {
                card.style.display = 'flex';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        // Show/hide coming soon message based on visible calculators
        if (visibleCount === 0 && category !== 'all') {
            comingSoonMessage.style.display = 'block';
        } else {
            comingSoonMessage.style.display = 'none';
        }
    });
});

// Optional: Add CSS styles if not already defined
const style = document.createElement('style');
style.textContent = `
    .coming-soon-message .coming-soon-content i {
        font-size: 3rem;
        color: #007bff;
        margin-bottom: 15px;
        display: block;
    }
    
    .coming-soon-message .coming-soon-content h3 {
        font-size: 1.5rem;
        color: #333;
        margin-bottom: 10px;
        font-weight: 600;
    }
    
    .coming-soon-message .coming-soon-content p {
        font-size: 1rem;
        color: #666;
        margin: 0;
        max-width: 400px;
        margin: 0 auto;
        line-height: 1.5;
    }
    
    @media (max-width: 768px) {
        .coming-soon-message {
            padding: 40px 15px !important;
        }
        
        .coming-soon-message .coming-soon-content i {
            font-size: 2.5rem;
        }
        
        .coming-soon-message .coming-soon-content h3 {
            font-size: 1.3rem;
        }
        
        .coming-soon-message .coming-soon-content p {
            font-size: 0.9rem;
        }
    }
`;
document.head.appendChild(style);