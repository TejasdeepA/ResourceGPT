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
        console.log('Selected platform:', selectedPlatform);
        
        const response = await fetch(`https://resourcegpt-backend-chhj.onrender.com/api/search?query=${encodeURIComponent(query)}&platform=${selectedPlatform}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        console.log('Search response:', data);
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
    console.log('Results to display:', results);

    // Sort resources by relevance and quality
    const sortedResources = data
        .sort((a, b) => {
            // Prioritize courses and comprehensive content
            const aIsCourse = a.type === 'playlist' || a.title.toLowerCase().includes('course');
            const bIsCourse = b.type === 'playlist' || b.title.toLowerCase().includes('course');
            if (aIsCourse !== bIsCourse) return aIsCourse ? -1 : 1;
            
            // Then sort by platform-specific metrics
            if (a.platform === b.platform) {
                switch (a.platform) {
                    case 'GitHub':
                        return (b.stargazers_count || 0) - (a.stargazers_count || 0);
                    case 'Reddit':
                        return (b.ups || 0) - (a.ups || 0);
                    case 'YouTube':
                        return (b.views || 0) - (a.views || 0);
                    default:
                        return 0;
                }
            }
            return 0;
        });

    sortedResources.forEach(resource => {
        const badges = getResourceBadges(resource);
        const badgeElements = createBadgeElements(badges);
        
        const resourceElement = document.createElement('div');
        resourceElement.className = 'resource-item';
        
        // Create platform icon
        const platformIcon = getPlatformIcon(resource.platform);
        
        resourceElement.innerHTML = `
            <div class="resource-header">
                <div class="resource-platform-icon">
                    ${platformIcon}
                </div>
                <div class="resource-content">
                    <h3 class="resource-title">
                        <a href="${resource.url}" target="_blank" rel="noopener noreferrer">
                            ${resource.title}
                        </a>
                    </h3>
                    <div class="badge-container">
                        ${badgeElements}
                    </div>
                </div>
            </div>
            <p class="resource-description">${resource.description || 'No description available.'}</p>
            <div class="resource-meta">
                ${resource.author ? `<span class="author">By ${resource.author}</span>` : ''}
                ${resource.platform === 'YouTube' && resource.type === 'playlist' 
                    ? `<span class="playlist-info">Playlist • ${resource.videoCount} videos</span>` 
                    : ''}
                ${resource.platform === 'YouTube' && resource.type === 'video'
                    ? `<span class="view-count">${formatNumber(resource.views)} views</span>`
                    : ''}
            </div>
        `;
        resourceList.appendChild(resourceElement);
    });
}

// Function to get platform icon
function getPlatformIcon(platform) {
    if (!platform) return '<i class="fas fa-link" style="color: #757575; font-size: 24px;"></i>';
    
    const icons = {
        youtube: '<i class="fab fa-youtube" style="color: #FF0000; font-size: 24px;"></i>',
        github: '<i class="fab fa-github" style="color: #24292e; font-size: 24px;"></i>',
        reddit: '<i class="fab fa-reddit" style="color: #FF4500; font-size: 24px;"></i>',
        freecodecamp: '<i class="fab fa-free-code-camp" style="color: #0a0a23; font-size: 24px;"></i>',
        archive: '<i class="fas fa-archive" style="color: #2196F3; font-size: 24px;"></i>'
    };

    const platformKey = platform.toLowerCase();
    return icons[platformKey] || '<i class="fas fa-link" style="color: #757575; font-size: 24px;"></i>';
}

// Function to determine badges for a resource
function getResourceBadges(item) {
    if (!item) return [];
    const badges = [];
    
    // Platform badges with metrics
    const platform = (item.platform || item.source || '').toLowerCase();
    switch(platform) {
        case 'youtube':
            badges.push({
                text: 'YouTube',
                class: 'badge-youtube',
                icon: 'fab fa-youtube'
            });
            if (item.type === 'playlist' || item.videoCount > 1) {
                badges.push({
                    text: 'Course',
                    class: 'badge-course',
                    icon: 'fas fa-graduation-cap'
                });
            }
            if (item.views) {
                badges.push({
                    text: `${formatNumber(item.views)} views`,
                    class: 'badge-metric',
                    icon: 'fas fa-eye'
                });
            }
            break;
            
        case 'github':
            badges.push({
                text: 'GitHub',
                class: 'badge-github',
                icon: 'fab fa-github'
            });
            if (item.stars || item.stargazers_count) {
                badges.push({
                    text: `${formatNumber(item.stars || item.stargazers_count)} stars`,
                    class: 'badge-metric',
                    icon: 'fas fa-star'
                });
            }
            if (item.language) {
                badges.push({
                    text: item.language,
                    class: 'badge-language',
                    icon: 'fas fa-code'
                });
            }
            break;
            
        case 'reddit':
            badges.push({
                text: 'Reddit',
                class: 'badge-reddit',
                icon: 'fab fa-reddit'
            });
            if (item.score || item.ups) {
                badges.push({
                    text: `${formatNumber(item.score || item.ups)} upvotes`,
                    class: 'badge-metric',
                    icon: 'fas fa-arrow-up'
                });
            }
            if (item.numComments) {
                badges.push({
                    text: `${formatNumber(item.numComments)} comments`,
                    class: 'badge-metric',
                    icon: 'fas fa-comments'
                });
            }
            break;
            
        case 'freecodecamp':
            badges.push({
                text: 'freeCodeCamp',
                class: 'badge-freecodecamp',
                icon: 'fab fa-free-code-camp'
            });
            if (item.type === 'article') {
                badges.push({
                    text: 'Article',
                    class: 'badge-type',
                    icon: 'fas fa-newspaper'
                });
                if (item.publishedAt) {
                    const date = new Date(item.publishedAt);
                    badges.push({
                        text: date.toLocaleDateString(),
                        class: 'badge-date',
                        icon: 'fas fa-calendar'
                    });
                }
            } else if (item.type === 'forum') {
                badges.push({
                    text: 'Forum',
                    class: 'badge-type',
                    icon: 'fas fa-comments'
                });
                if (item.replies) {
                    badges.push({
                        text: `${formatNumber(item.replies)} replies`,
                        class: 'badge-metric',
                        icon: 'fas fa-reply'
                    });
                }
                if (item.views) {
                    badges.push({
                        text: `${formatNumber(item.views)} views`,
                        class: 'badge-metric',
                        icon: 'fas fa-eye'
                    });
                }
            } else if (item.type === 'curriculum') {
                badges.push({
                    text: 'Tutorial',
                    class: 'badge-tutorial',
                    icon: 'fas fa-graduation-cap'
                });
            }
            break;
            
        case 'internet-archive':
        case 'archive':
            badges.push({
                text: 'Internet Archive',
                class: 'badge-archive',
                icon: 'fas fa-archive'
            });
            if (item.downloads) {
                badges.push({
                    text: `${formatNumber(item.downloads)} downloads`,
                    class: 'badge-metric',
                    icon: 'fas fa-download'
                });
            }
            if (item.year) {
                badges.push({
                    text: item.year,
                    class: 'badge-date',
                    icon: 'fas fa-calendar'
                });
            }
            if (item.mediaType) {
                badges.push({
                    text: item.mediaType,
                    class: 'badge-type',
                    icon: 'fas fa-file'
                });
            }
            break;
    }

    // Content type badges
    if (item.type === 'tutorial' || item.title.toLowerCase().includes('tutorial')) {
        badges.push({
            text: 'Tutorial',
            class: 'badge-tutorial',
            icon: 'fas fa-chalkboard-teacher'
        });
    }

    if (item.type === 'course' || item.title.toLowerCase().includes('course')) {
        badges.push({
            text: 'Course',
            class: 'badge-course',
            icon: 'fas fa-graduation-cap'
        });
    }

    // Beginner friendly badge
    const beginnerTerms = ['beginner', 'basics', 'introduction', 'getting started', '101', 'fundamental'];
    if (beginnerTerms.some(term => 
        (item.title && typeof item.title === 'string' && item.title.toLowerCase().includes(term)) || 
        (item.description && typeof item.description === 'string' && item.description.toLowerCase().includes(term))
    )) {
        badges.push({
            text: 'Beginner Friendly',
            class: 'badge-beginner',
            icon: 'fas fa-seedling'
        });
    }

    // Trending badge based on metrics
    const isTrending = (
        (item.platform === 'GitHub' && (item.stars || item.stargazers_count) > 1000) ||
        (item.platform === 'Reddit' && (item.score || item.ups) > 100) ||
        (item.platform === 'YouTube' && item.views > 10000) ||
        (item.platform === 'freeCodeCamp' && item.views > 5000) ||
        (item.platform === 'Internet Archive' && item.downloads > 1000)
    );

    if (isTrending) {
        badges.push({
            text: 'Trending',
            class: 'badge-trending',
            icon: 'fas fa-fire'
        });
    }

    return badges;
}

// Function to create badge elements
function createBadgeElements(badges) {
    return badges.map(badge => `
        <span class="badge ${badge.class}">
            <i class="${badge.icon}"></i>
            ${badge.text}
        </span>
    `).join('');
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
