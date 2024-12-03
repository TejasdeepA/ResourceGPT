// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Search Functionality
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');
    const inputContainer = document.querySelector('.input-container');
    const platformForm = document.querySelector('.platform-selector form');
    
    // Reset the layout when the page loads
    inputContainer.classList.remove('elevated');
    document.getElementById('resource-list').classList.remove('visible');
  
    searchButton.addEventListener('click', handleSearch);
  
    // Enable Enter key to trigger search
    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        handleSearch();
      }
    });

    // Add platform change listener
    platformForm.addEventListener('change', (e) => {
        const selectedPlatform = platformForm.querySelector('input[name="platform"]:checked').value;
        console.log('Selected platform:', selectedPlatform);
        // Trigger search if there's a query
        if (searchInput.value.trim()) {
            handleSearch();
        }
    });
});

// Function to handle search
async function handleSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) {
        alert('Please enter a search query.');
        return;
    }

    // Add elevated class to container
    document.querySelector('.input-container').classList.add('elevated');
  
    // Show loading indicator
    const resourceList = document.getElementById('resource-list');
    resourceList.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Searching across platforms...</p>
        </div>`;
    resourceList.classList.add('visible');
  
    try {
        const form = document.querySelector('.platform-selector form');
        const selectedPlatform = form.querySelector('input[name="platform"]:checked').value;
        const response = await fetch(`http://localhost:5000/api/search?query=${encodeURIComponent(query)}&platform=${selectedPlatform}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        displayResources(data);
    } catch (error) {
        console.error('Error fetching resources:', error);
        resourceList.innerHTML = '<div class="error">Error fetching resources. Please try again later.</div>';
    }
}

// Function to display resources
function displayResources(data) {
    const resourceList = document.getElementById('resource-list');
    resourceList.innerHTML = ''; // Clear previous results
  
    const results = data.results || {};
    const allResources = [];
    const selectedPlatform = document.querySelector('.platform-selector form input[name="platform"]:checked').value;
  
    // Combine all results into a single array with source information
    if (results.github && (selectedPlatform === 'all' || selectedPlatform === 'github')) {
        allResources.push(...results.github.map(repo => ({
            ...repo,
            source: 'github',
            description: truncateText(repo.description, 'github')
        })));
    }
  
    if (results.reddit && (selectedPlatform === 'all' || selectedPlatform === 'reddit')) {
        allResources.push(...results.reddit.map(post => ({
            ...post,
            source: 'reddit',
            description: truncateText(post.description, 'reddit')
        })));
    }
  
    if (results.youtube && (selectedPlatform === 'all' || selectedPlatform === 'youtube')) {
        allResources.push(...results.youtube.map(video => ({
            ...video,
            source: 'youtube',
            description: truncateText(video.description, 'youtube')
        })));
    }
  
    // Display all resources in a single section
    if (allResources.length > 0) {
        const section = document.createElement('div');
        section.className = 'resource-section';
        
        const sectionTitle = document.createElement('h2');
        sectionTitle.className = 'section-title';
        sectionTitle.textContent = selectedPlatform === 'all' ? 'Search Results' : `${selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} Results`;
        section.appendChild(sectionTitle);
        
        const resourceItems = document.createElement('div');
        resourceItems.className = 'resource-items';
        
        allResources.forEach((item, index) => {
            const resourceItem = document.createElement('div');
            resourceItem.className = 'resource-item';
            
            const rankBadge = document.createElement('div');
            rankBadge.className = 'rank-badge';
            rankBadge.textContent = `#${index + 1}`;
            resourceItem.appendChild(rankBadge);
            
            const content = document.createElement('div');
            content.className = 'resource-content';
            
            if (item.thumbnail) {
                const thumbnail = document.createElement('img');
                thumbnail.src = item.thumbnail;
                thumbnail.className = 'resource-thumbnail';
                content.appendChild(thumbnail);
            }
            
            const title = document.createElement('a');
            title.href = item.url;
            title.target = '_blank';
            title.className = 'resource-title result-link';
            title.setAttribute('data-source', item.source);
            title.textContent = item.title;
            content.appendChild(title);
            
            const description = document.createElement('p');
            description.className = 'resource-description';
            description.textContent = item.description;
            content.appendChild(description);
            
            // Add badges
            const badges = getResourceBadges(item);
            if (badges.length > 0) {
                content.appendChild(createBadgeElements(badges));
            }
            
            // Add metrics based on source
            const metrics = document.createElement('div');
            metrics.className = 'resource-metrics';
            
            if (item.source === 'reddit' && item.upvotes !== undefined) {
                const upvotes = document.createElement('span');
                upvotes.className = 'metric upvotes';
                upvotes.innerHTML = `<i class="fas fa-arrow-up"></i> ${formatNumber(item.upvotes)}`;
                metrics.appendChild(upvotes);
            }
            
            if (item.source === 'youtube') {
                if (item.views !== undefined) {
                    const views = document.createElement('span');
                    views.className = 'metric views';
                    views.innerHTML = `<i class="fas fa-eye"></i> ${formatNumber(item.views)}`;
                    metrics.appendChild(views);
                }
                if (item.likes !== undefined) {
                    const likes = document.createElement('span');
                    likes.className = 'metric likes';
                    likes.innerHTML = `<i class="fas fa-thumbs-up"></i> ${formatNumber(item.likes)}`;
                    metrics.appendChild(likes);
                }
            }
            
            content.appendChild(metrics);
            resourceItem.appendChild(content);
            resourceItems.appendChild(resourceItem);
        });
        
        section.appendChild(resourceItems);
        resourceList.appendChild(section);
    } else {
        resourceList.innerHTML = '<div class="no-results">No resources found. Try a different search query.</div>';
    }
}

// Function to determine badges for a resource
function getResourceBadges(item) {
    let score = 0;
    
    // Base score calculation
    if (item.description) {
        const wordCount = item.description.split(/\s+/).length;
        score += Math.floor(wordCount / 200); // Add 1 point per 200 words
    }

    // Title-based scoring
    const titleLower = item.title.toLowerCase();
    if (/beginner|start|basic|introduction|tutorial|learn|easy/i.test(titleLower)) {
        score -= 3;
    }
    if (/advanced|expert|deep dive|comprehensive|mastery|professional/i.test(titleLower)) {
        score += 3;
    }

    // Platform-specific scoring
    switch (item.source) {
        case 'youtube':
            if (item.duration) {
                score += Math.floor(item.duration / 600); // Add 1 point per 10 minutes
            }
            if (item.views) {
                if (item.views > 500000) score += 3;
                else if (item.views > 100000) score += 2;
            }
            break;

        case 'github':
            if (item.stars) {
                if (item.stars > 10000) score += 3;
                else if (item.stars > 5000) score += 2;
                else if (item.stars > 1000) score += 1;
            }
            break;

        case 'reddit':
            if (item.upvotes) {
                if (item.upvotes > 5000) score += 3;
                else if (item.upvotes > 1000) score += 2;
                else if (item.upvotes > 500) score += 1;
            }
            break;
    }

    // Determine badge based on final score
    if (score > 5) {
        return [{
            type: 'in-depth',
            icon: 'square',
            text: 'In-Depth'
        }];
    } else if (score < 0) {
        return [{
            type: 'beginner',
            icon: 'circle',
            text: 'Beginner-Friendly'
        }];
    } else if (
        (item.source === 'youtube' && item.views > 500000) ||
        (item.source === 'github' && item.stars > 10000) ||
        (item.source === 'reddit' && item.upvotes > 5000)
    ) {
        return [{
            type: 'trending',
            icon: 'fire',
            text: 'Trending'
        }];
    }

    return []; // No badge if no clear category
}

// Function to create badge elements
function createBadgeElements(badges) {
    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'resource-badges';
    
    badges.forEach(badge => {
        const badgeElement = document.createElement('span');
        badgeElement.className = `resource-badge badge-${badge.type}`;
        badgeElement.innerHTML = `<i class="fas fa-${badge.icon}"></i> ${badge.text}`;
        badgesContainer.appendChild(badgeElement);
    });
    
    return badgesContainer;
}

// Function to truncate text with character limit
function truncateText(text, source = '') {
    if (!text) return '';
    // Shorter limit for GitHub descriptions
    const maxLength = source === 'github' ? 60 : 100;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim().replace(/[.,;]?\s+\S*$/, '') + '...';
}

// Helper function to format numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}