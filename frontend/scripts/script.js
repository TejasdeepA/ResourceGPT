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
  
    // Show loading indicator or clear previous results
    const resourceList = document.getElementById('resource-list');
    resourceList.innerHTML = '<p>Loading...</p>';
  
    try {
      const response = await fetch(`http://localhost:5000/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const resources = await response.json();
      displayResources(resources);
    } catch (error) {
      console.error('Error fetching resources:', error);
      resourceList.innerHTML = '<p>Error fetching resources. Please try again later.</p>';
    }
  }
  
  // Function to display resources
  function displayResources(resources) {
    const resourceList = document.getElementById('resource-list');
    resourceList.innerHTML = ''; // Clear previous results
  
    if (resources.length === 0) {
      resourceList.innerHTML = '<p>No resources found.</p>';
      return;
    }
  
    resources.forEach(resource => {
      const resourceItem = document.createElement('div');
      resourceItem.className = 'resource-item';
  
      // Resource Title
      const titleLink = document.createElement('a');
      titleLink.href = resource.url;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.className = 'resource-title';
      titleLink.textContent = resource.title;
  
      // Resource URL
      const urlDiv = document.createElement('div');
      urlDiv.className = 'resource-url';
      urlDiv.textContent = resource.url;
  
      // Resource Snippet
      const snippetDiv = document.createElement('div');
      snippetDiv.className = 'resource-snippet';
      snippetDiv.innerHTML = resource.description;
  
      resourceItem.appendChild(titleLink);
      resourceItem.appendChild(urlDiv);
      resourceItem.appendChild(snippetDiv);
  
      resourceList.appendChild(resourceItem);
    });
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
  
    const themeToggleButton = document.getElementById('theme-toggle-button');
    themeToggleButton.textContent = theme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme';
  }
  