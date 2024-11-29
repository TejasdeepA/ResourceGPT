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
  
    const results = data.results || {};
    const allResources = [];
  
    // Combine all results into a single array with source information
    if (results.github) {
        allResources.push(...results.github.map(repo => ({
            ...repo,
            source: 'github'
        })));
    }
  
    if (results.reddit) {
        allResources.push(...results.reddit.map(post => ({
            ...post,
            source: 'reddit'
        })));
    }
  
    if (results.youtube) {
        allResources.push(...results.youtube.map(video => ({
            ...video,
            source: 'youtube'
        })));
    }
  
    // Display all resources in a single section
    if (allResources.length > 0) {
        const section = document.createElement('div');
        section.className = 'resource-section';
        
        const sectionTitle = document.createElement('h2');
        sectionTitle.className = 'section-title';
        sectionTitle.textContent = 'Search Results';
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
            title.className = 'resource-title';
            title.textContent = item.title;
            content.appendChild(title);
            
            const description = document.createElement('p');
            description.className = 'resource-description';
            description.textContent = item.description;
            content.appendChild(description);
            
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