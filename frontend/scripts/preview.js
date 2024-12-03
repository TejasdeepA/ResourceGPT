class PreviewWindow {
    constructor() {
        this.previewEl = this.createPreviewElement();
        this.currentLink = null;
        this.hideTimeout = null;
        this.setupEventListeners();
    }

    createPreviewElement() {
        const el = document.createElement('div');
        el.className = 'preview-window';
        document.body.appendChild(el);
        return el;
    }

    setupEventListeners() {
        document.addEventListener('mouseover', async (e) => {
            const resultLink = e.target.closest('.result-link');
            if (resultLink && resultLink !== this.currentLink) {
                clearTimeout(this.hideTimeout);
                this.currentLink = resultLink;
                await this.showPreview(resultLink);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const resultLink = e.target.closest('.result-link');
            const previewWindow = e.relatedTarget?.closest('.preview-window');
            
            if (resultLink && !previewWindow) {
                this.hideTimeout = setTimeout(() => this.hidePreview(), 300);
            }
        });

        this.previewEl.addEventListener('mouseenter', () => {
            clearTimeout(this.hideTimeout);
        });

        this.previewEl.addEventListener('mouseleave', () => {
            this.hidePreview();
        });
    }

    async showPreview(link) {
        const rect = link.getBoundingClientRect();
        const source = link.getAttribute('data-source');
        
        // Position the preview window
        const windowHeight = window.innerHeight;
        const previewHeight = 200; // Approximate height
        
        let topPosition = window.scrollY + rect.top;
        if (rect.top + previewHeight > windowHeight) {
            topPosition = window.scrollY + rect.top - previewHeight + rect.height;
        }
        
        this.previewEl.style.left = `${rect.right + 10}px`;
        this.previewEl.style.top = `${topPosition}px`;
        
        // Show loading state
        this.previewEl.innerHTML = `
            <div class="preview-loading">
                <div class="loading-spinner"></div>
                <span>Loading preview...</span>
            </div>
        `;
        this.previewEl.classList.add('visible');

        try {
            console.log('Fetching preview for:', link.href);
            const response = await fetch('http://localhost:5000/api/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url: link.href,
                    source: source
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch preview');
            }
            
            // Update preview content with platform-specific styling
            this.previewEl.innerHTML = `
                <div class="preview-content ${source}">
                    <div class="preview-header">
                        <i class="fas ${this.getSourceIcon(source)}"></i>
                        <span class="preview-title">${data.title || 'Preview'}</span>
                    </div>
                    <div class="preview-body">
                        ${data.summary || 'No preview available'}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Preview error:', error);
            this.previewEl.innerHTML = `
                <div class="preview-error">
                    <i class="fas fa-info-circle"></i>
                    ${error.message || 'Unable to load preview'}
                </div>
            `;
        }
    }

    getSourceIcon(source) {
        switch (source) {
            case 'youtube': return 'fa-youtube';
            case 'github': return 'fa-github';
            case 'reddit': return 'fa-reddit';
            default: return 'fa-link';
        }
    }

    hidePreview() {
        this.currentLink = null;
        this.previewEl.classList.remove('visible');
    }
}

// Initialize preview window
document.addEventListener('DOMContentLoaded', () => {
    new PreviewWindow();
});
