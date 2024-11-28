// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Theme
    initializeTheme();
  
    // Initialize Search Functionality
    const searchButton = document.getElementById('search-button');
    searchButton.addEventListener('click', handleSearch);
  
    // Enable Enter key to trigger search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
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
  
    // Show loading indicator
    const resourceList = document.getElementById('resource-list');
    resourceList.innerHTML = '<div class="loading">Searching resources...</div>';
  
    try {
        const response = await fetch(`http://localhost:5000/api/search?query=${encodeURIComponent(query)}`);
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
  
    // Display extracted keywords
    if (data.keywords && data.keywords.length > 0) {
        const keywordsDiv = document.createElement('div');
        keywordsDiv.className = 'keywords';
        keywordsDiv.innerHTML = `<strong>Keywords:</strong> ${data.keywords.join(', ')}`;
        resourceList.appendChild(keywordsDiv);
    }
  
    const results = data.results || {};
    const allResults = [];
  
    // Process GitHub results
    if (results.github && results.github.length > 0) {
        const githubSection = createSection('GitHub Repositories', results.github.map(repo => ({
            title: repo.title,
            url: repo.url,
            description: `${repo.description || 'No description available'} (⭐ ${repo.stars})`,
            type: 'github'
        })));
        resourceList.appendChild(githubSection);
    }
  
    // Process Reddit results
    if (results.reddit && results.reddit.length > 0) {
        const redditSection = createSection('Reddit Discussions', results.reddit.map(post => ({
            title: post.title,
            url: post.url,
            description: post.description || 'No description available',
            type: 'reddit'
        })));
        resourceList.appendChild(redditSection);
    }
  
    // Process YouTube results
    if (results.youtube && results.youtube.length > 0) {
        const youtubeSection = createSection('YouTube Videos', results.youtube.map(video => ({
            title: video.title,
            url: video.url,
            description: video.description || 'No description available',
            thumbnail: video.thumbnail,
            type: 'youtube'
        })));
        resourceList.appendChild(youtubeSection);
    }
  
    // Show no results message if nothing found
    if (!results.github?.length && !results.reddit?.length && !results.youtube?.length) {
        resourceList.innerHTML = '<div class="no-results">No resources found.</div>';
    }
}

// Function to create a section of results
function createSection(title, items) {
    const section = document.createElement('div');
    section.className = 'resource-section';
    
    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = title;
    section.appendChild(sectionTitle);
    
    items.forEach(item => {
        const resourceItem = document.createElement('div');
        resourceItem.className = `resource-item ${item.type}`;
        
        // Resource Title
        const titleLink = document.createElement('a');
        titleLink.href = item.url;
        titleLink.target = '_blank';
        titleLink.rel = 'noopener noreferrer';
        titleLink.className = 'resource-title';
        titleLink.textContent = item.title;
        
        // Thumbnail for YouTube videos
        if (item.type === 'youtube' && item.thumbnail) {
            const thumbnail = document.createElement('img');
            thumbnail.src = item.thumbnail;
            thumbnail.alt = item.title;
            thumbnail.className = 'video-thumbnail';
            resourceItem.appendChild(thumbnail);
        }
        
        // Resource Description
        const snippetDiv = document.createElement('div');
        snippetDiv.className = 'resource-snippet';
        snippetDiv.textContent = item.description;
        
        resourceItem.appendChild(titleLink);
        resourceItem.appendChild(snippetDiv);
        
        section.appendChild(resourceItem);
    });
    
    return section;
}
  
// Function to initialize theme based on localStorage
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
  
    const themeToggleButton = document.getElementById('theme-toggle-button');
    themeToggleButton.addEventListener('click', toggleTheme);
}
  
// Function to toggle theme
function toggleTheme() {
    const currentTheme = document.body.classList.contains('light') ? 'light' : 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}
  
// Function to set theme
function setTheme(theme) {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    localStorage.setItem('theme', theme);
    
    // Update theme toggle button icon
    const themeIcon = document.querySelector('.theme-toggle-icon');
    themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
}