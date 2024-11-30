# ResourceGPT Documentation

## What is ResourceGPT?

ResourceGPT is an AI-powered learning resource aggregator that helps developers find the best educational content across multiple platforms. When you search for a programming topic (e.g., "how to build a REST API in Node.js"), ResourceGPT:

1. Uses Gemini 1.5 Flash AI to understand your query and extract key technical concepts
2. Searches across multiple platforms simultaneously:
   - GitHub: For real-world code examples and projects
   - YouTube: For video tutorials and explanations
   - Reddit: For discussions, tips, and community insights

3. Ranks and combines the results based on:
   - Relevance to your query
   - Content quality and depth
   - Community engagement (stars, likes, comments)
   - Educational value

### Why ResourceGPT?

Traditional search engines and platform-specific searches have limitations:
- They don't understand technical context well
- Results are often scattered across platforms
- Quality assessment requires manual effort
- No intelligent ranking based on educational value

ResourceGPT solves these problems by:
- Using AI to understand technical queries
- Aggregating resources from multiple platforms
- Automatically evaluating content quality
- Providing a unified, ranked list of the best resources

## How It Works: Deep Dive

### 1. Backend Architecture (server.js)

#### API Setup and Configuration
```javascript
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
```
This code:
- Sets up an Express.js server for handling HTTP requests
- Uses `cors` to allow frontend-backend communication
- Enables JSON parsing for request bodies
- Loads environment variables for API keys

#### API Keys and Endpoints
```javascript
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_SECRET = process.env.REDDIT_SECRET;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const GITHUB_API_URL = 'https://api.github.com/search/repositories';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_SEARCH_URL = 'https://oauth.reddit.com/search';
```
This section:
- Loads API keys from environment variables for security
- Defines API endpoints for each platform
- Separates configuration from business logic

### 2. Query Analysis (AI Integration)

#### Gemini Query Analysis
```javascript
async function analyzeQuery(query) {
  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [{
          text: `Analyze this search query and extract key technical terms and concepts for searching programming resources: "${query}". Return only the most relevant keywords separated by commas, focusing on technical terms.`
        }]
      }]
    });
    return response.data.candidates[0].content.parts[0].text.split(',').map(term => term.trim());
  } catch (error) {
    console.error('Error analyzing query with Gemini:', error);
    return query.split(' '); // Fallback to simple word splitting
  }
}
```
This function:
1. Takes a user's search query (e.g., "how to build a REST API in Node.js")
2. Sends it to Gemini 1.5 Flash for analysis
3. Extracts key technical terms (e.g., ["REST API", "Node.js", "backend", "Express"])
4. Provides fallback behavior if AI analysis fails

### 3. Platform-Specific Search Functions

#### GitHub Search
```javascript
async function searchGitHub(keywords) {
  try {
    const query = keywords.join('+');
    const response = await axios.get(`${GITHUB_API_URL}?q=${query}&sort=stars`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      }
    });
    return response.data.items.map(item => ({
      title: item.full_name,
      description: item.description,
      url: item.html_url,
      stars: item.stargazers_count,
      type: 'github'
    }));
  } catch (error) {
    console.error('Error searching GitHub:', error);
    return [];
  }
}
```
This function:
1. Takes keywords from query analysis
2. Searches GitHub repositories
3. Sorts by stars for quality
4. Returns formatted repository data

#### YouTube Search
```javascript
async function searchYouTube(keywords) {
  try {
    const query = keywords.join(' ');
    const response = await axios.get(YOUTUBE_API_URL, {
      params: {
        part: 'snippet',
        q: query + ' programming tutorial',
        key: YOUTUBE_API_KEY,
        type: 'video',
        maxResults: 10,
        relevanceLanguage: 'en'
      }
    });
    return response.data.items.map(item => ({
      title: item.snippet.title,
      description: item.snippet.description,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails.medium.url,
      type: 'youtube'
    }));
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return [];
  }
}
```
This function:
1. Searches YouTube for programming tutorials
2. Filters for English content
3. Returns video details with thumbnails

#### Reddit Search
```javascript
async function searchReddit(keywords) {
  try {
    const token = await getRedditAccessToken();
    const query = keywords.join(' ');
    const response = await axios.get(REDDIT_SEARCH_URL, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        q: query,
        subreddit: 'programming+learnprogramming+webdev+coding',
        sort: 'relevance',
        limit: 10
      }
    });
    return response.data.data.children.map(post => ({
      title: post.data.title,
      description: post.data.selftext.substring(0, 200),
      url: `https://reddit.com${post.data.permalink}`,
      score: post.data.score,
      type: 'reddit'
    }));
  } catch (error) {
    console.error('Error searching Reddit:', error);
    return [];
  }
}
```
This function:
1. Gets Reddit OAuth token
2. Searches programming-related subreddits
3. Returns formatted post data

### 4. Resource Ranking

```javascript
async function rankResources(query, resources) {
  try {
    const prompt = `Given the search query "${query}", rank these resources based on their relevance, quality, and educational value. 
    Consider:
    - Content relevance to query
    - Technical depth and accuracy
    - Educational value for learners
    - Community engagement metrics
    
    Resources:
    ${resources.map((r, i) => `${i}. ${r.title}\n${r.description}\n`).join('\n')}
    
    Return a JSON array of indices for the top most valuable resources.`;

    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });
    
    const rankings = JSON.parse(response.data.candidates[0].content.parts[0].text);
    return rankings.map(index => resources[index]);
  } catch (error) {
    console.error('Error ranking resources:', error);
    return resources; // Return unranked on error
  }
}
```
This function:
1. Takes all gathered resources
2. Uses Gemini to evaluate each resource
3. Ranks based on multiple factors
4. Returns ordered list of best resources

### 5. Frontend Implementation

#### Search Interface (index.html)
```html
<div class="search-bar">
  <input type="text" id="search-input" 
         placeholder="Search for computer science resources...">
  <button id="search-button">
    <svg><!-- Search icon SVG --></svg>
  </button>
</div>
```
The search interface:
- Provides clean, focused input
- Shows loading states during search
- Handles errors gracefully

#### Resource Display (script.js)
```javascript
function displayResults(resources) {
  const resourceList = document.getElementById('resource-list');
  resourceList.innerHTML = '';
  
  resources.forEach(resource => {
    const card = document.createElement('div');
    card.className = `resource-card ${resource.type}`;
    
    card.innerHTML = `
      <div class="resource-header">
        <img src="${getSourceIcon(resource.type)}" alt="${resource.type}">
        <h3>${resource.title}</h3>
      </div>
      <p>${resource.description}</p>
      <div class="resource-metrics">
        ${getMetrics(resource)}
      </div>
      <a href="${resource.url}" target="_blank">View Resource</a>
    `;
    
    resourceList.appendChild(card);
  });
}
```
This function:
1. Creates cards for each resource
2. Shows source-specific icons
3. Displays relevant metrics
4. Provides direct links

#### Styling (styles.css)
```css
.resource-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.resource-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.resource-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.resource-metrics {
  display: flex;
  gap: 16px;
  color: #666;
  font-size: 0.9em;
  margin-top: 12px;
}
```
The styling:
1. Creates modern, clean card design
2. Provides subtle animations
3. Ensures responsive layout
4. Maintains consistent branding

## How to Use ResourceGPT

1. **Basic Search**
   - Enter a programming-related query
   - Example: "React hooks tutorial"
   - Click search or press Enter

2. **Understanding Results**
   - GitHub results show:
     - Repository name
     - Description
     - Stars count
     - Main programming language

   - YouTube results show:
     - Video title
     - Channel name
     - View count
     - Duration
     - Thumbnail

   - Reddit results show:
     - Post title
     - Preview of content
     - Subreddit
     - Upvote count

3. **Advanced Usage**
   - Use specific technical terms
   - Include desired resource type
   - Specify difficulty level
   - Example: "advanced Node.js security best practices"

4. **Result Interpretation**
   - Resources are ranked by:
     - Relevance to query
     - Content quality
     - Community engagement
     - Educational value

## Development and Extension

### Adding New Features

1. **New Resource Platform**
   ```javascript
   async function searchNewPlatform(keywords) {
     // 1. Set up API configuration
     // 2. Implement search logic
     // 3. Format results
     // 4. Add error handling
   }
   ```

2. **Custom Result Ranking**
   ```javascript
   function customRankingLogic(resources) {
     // 1. Define ranking criteria
     // 2. Implement scoring system
     // 3. Sort resources
     // 4. Return ranked list
   }
   ```

3. **UI Enhancements**
   ```javascript
   function addCustomFeature() {
     // 1. Create UI elements
     // 2. Add event listeners
     // 3. Implement functionality
     // 4. Update styles
   }
   ```

## Table of Contents
1. [Project Structure](#project-structure)
2. [Technology Stack](#technology-stack)
3. [Complete Build Guide](#complete-build-guide)
4. [API Integration](#api-integration)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend Architecture](#backend-architecture)
7. [Development Guide](#development-guide)

## Project Structure
```
ResourceGPT/
├── backend/
│   └── server.js           # Main Express server file
├── frontend/
│   ├── index.html         # Main HTML entry point
│   ├── scripts/           # JavaScript files
│   │   └── script.js      # Main frontend logic
│   └── styles/           # CSS styling files
│       ├── styles.css    # Main styles
│       ├── SearchBar.css # Search component styles
│       └── ResourceList.css # Results component styles
├── node_modules/
├── package.json
└── package-lock.json
```

## Technology Stack
- **Backend**
  - Node.js with Express.js
  - Axios for HTTP requests
  - CORS for cross-origin resource sharing
  - dotenv for environment variable management

- **Frontend**
  - Vanilla JavaScript
  - HTML5
  - CSS3
  - Font Awesome for icons
  - Poppins font from Google Fonts

- **APIs**
  - Google Gemini 1.5 Flash API (AI analysis)
  - GitHub API (Repository search)
  - YouTube API (Video search)
  - Reddit API (Discussion search)

## Complete Build Guide

### Step 1: Project Setup
1. Create project directory:
   ```bash
   mkdir ResourceGPT
   cd ResourceGPT
   ```

2. Initialize Node.js project:
   ```bash
   npm init -y
   ```

3. Install required dependencies:
   ```bash
   npm install express axios cors dotenv
   ```

### Step 2: Backend Development

1. Create backend directory and server file:
   ```bash
   mkdir backend
   touch backend/server.js
   ```

2. Create server.js with the following code:
   ```javascript
   const express = require('express');
   const axios = require('axios');
   const cors = require('cors');
   require('dotenv').config();

   const app = express();
   app.use(cors());
   app.use(express.json());

   // API Keys and Credentials
   const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
   const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
   const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
   const REDDIT_SECRET = process.env.REDDIT_SECRET;
   const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

   // API Endpoints
   const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
   
   // Add other endpoint constants...

   // Implement API functions...
   
   app.listen(3000, () => {
     console.log('Server running on port 3000');
   });
   ```

### Step 3: Frontend Development

1. Create frontend directory structure:
   ```bash
   mkdir -p frontend/styles frontend/scripts
   touch frontend/index.html
   touch frontend/styles/{styles.css,SearchBar.css,ResourceList.css}
   touch frontend/scripts/script.js
   ```

2. Create index.html:
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>ResourceGPT</title>
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
     <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap" rel="stylesheet">
     <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
     <link rel="stylesheet" href="styles/styles.css">
     <link rel="stylesheet" href="styles/SearchBar.css">
     <link rel="stylesheet" href="styles/ResourceList.css">
   </head>
   <body>
     <!-- Add HTML structure -->
   </body>
   </html>
   ```

3. Create styles:
   ```css
   /* styles.css */
   :root {
     --primary-color: #4a90e2;
     --background-color: #f5f5f5;
     /* Add other variables */
   }

   /* Add base styles */

   /* SearchBar.css */
   .search-bar {
     /* Add search bar styles */
   }

   /* ResourceList.css */
   .resource-list {
     /* Add resource list styles */
   }
   ```

4. Implement frontend logic in script.js:
   ```javascript
   // Constants
   const API_URL = 'http://localhost:3000/api/search';

   // Event listeners
   document.addEventListener('DOMContentLoaded', () => {
     // Initialize app
   });

   // API calls
   async function searchResources(query) {
     // Implement search functionality
   }

   // UI updates
   function displayResults(resources) {
     // Implement results display
   }
   ```

### Step 4: API Integration

#### Gemini 1.5 Flash Integration
```javascript
async function analyzeQuery(query) {
  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [{
          text: `Analyze this search query and extract key technical terms and concepts for searching programming resources: "${query}". Return only the most relevant keywords separated by commas, focusing on technical terms.`
        }]
      }]
    });
    return response.data.candidates[0].content.parts[0].text.split(',').map(term => term.trim());
  } catch (error) {
    console.error('Error analyzing query with Gemini:', error);
    return query.split(' '); // Fallback to simple word splitting
  }
}
```

#### GitHub Integration
```javascript
async function searchGitHub(keywords) {
  try {
    const query = keywords.join('+');
    const response = await axios.get(`${GITHUB_API_URL}?q=${query}&sort=stars`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      }
    });
    return response.data.items.map(item => ({
      title: item.full_name,
      description: item.description,
      url: item.html_url,
      stars: item.stargazers_count
    }));
  } catch (error) {
    console.error('Error searching GitHub:', error);
    return [];
  }
}
```

### Step 5: Testing and Deployment

1. Set up environment variables:
   ```bash
   touch .env
   ```
   Add to .env:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   GITHUB_TOKEN=your_github_token
   REDDIT_CLIENT_ID=your_reddit_client_id
   REDDIT_SECRET=your_reddit_secret
   YOUTUBE_API_KEY=your_youtube_api_key
   ```

2. Start the servers:
   ```bash
   # Terminal 1 - Backend
   cd backend
   node server.js

   # Terminal 2 - Frontend
   cd frontend
   npx http-server
   ```

3. Test the application:
   - Open browser to `http://localhost:8080`
   - Try searching for programming topics
   - Check browser console for errors
   - Verify API responses

## API Integration

### Gemini Pro Integration
The Gemini Pro API is used for two primary purposes:
1. Query Analysis: Extracts key technical terms from user queries
2. Resource Ranking: Evaluates and ranks resources based on relevance and quality

#### Query Analysis Function
```javascript
async function analyzeQuery(query) {
  // Sends query to Gemini Pro
  // Returns array of relevant keywords
}
```

#### Resource Ranking Function
```javascript
async function rankResources(query, resources) {
  // Ranks resources based on relevance and quality
  // Returns ordered array of resource indices
}
```

### Platform-Specific APIs

#### GitHub Search
- Searches for repositories using the GitHub API
- Sorts results by stars (popularity)
- Returns repository details including:
  - Title
  - Description
  - Stars
  - URL

#### YouTube Search
- Searches for programming-related videos
- Filters for relevant content using query keywords
- Returns video details including:
  - Title
  - Description
  - Channel name
  - URL

#### Reddit Search
- Implements OAuth 2.0 authentication
- Searches across programming subreddits
- Returns discussion threads including:
  - Title
  - Content preview
  - Subreddit
  - URL

## Frontend Architecture

### Components

#### Search Bar
- Located in `frontend/styles/SearchBar.css`
- Features:
  - Clean, modern design
  - Responsive input field
  - Animated search button

#### Resource List
- Located in `frontend/styles/ResourceList.css`
- Displays search results in a card format
- Includes source icons and relevance indicators

### JavaScript Implementation
- Main logic in `frontend/scripts/script.js`
- Handles:
  - User input processing
  - API requests to backend
  - Dynamic resource rendering
  - Error handling and user feedback

## Backend Architecture

### Server Implementation (server.js)
- Express.js server with middleware:
  - CORS enabled for frontend access
  - JSON parsing for request bodies
  - Environment variable configuration

### API Endpoints

#### GET /api/search
- Main search endpoint
- Parameters:
  - query: User's search query
- Process:
  1. Analyzes query using Gemini Pro
  2. Parallel searches across platforms
  3. Ranks and combines results
  4. Returns curated resource list

### Error Handling
- Comprehensive error handling for:
  - API failures
  - Rate limiting
  - Invalid queries
  - Authentication issues

## Development Guide

### Adding New Features
1. Backend Modifications:
   - Add new routes in `server.js`
   - Implement new API integrations
   - Update error handling

2. Frontend Enhancements:
   - Add new UI components in `index.html`
   - Create corresponding CSS in `styles/`
   - Implement JavaScript logic in `scripts/`

### Best Practices
- Keep API keys in `.env` file
- Implement proper error handling
- Use semantic HTML
- Follow CSS BEM naming convention
- Write clean, documented JavaScript code

### Testing
- Test API endpoints with Postman/curl
- Verify CORS functionality
- Check resource ranking accuracy
- Validate error handling
- Test responsive design

## Troubleshooting

### Common Issues and Solutions

1. CORS Errors
   ```javascript
   // In server.js
   app.use(cors({
     origin: 'http://localhost:8080',
     methods: ['GET', 'POST'],
     allowedHeaders: ['Content-Type']
   }));
   ```

2. API Rate Limiting
   - Implement request queuing
   - Add retry logic with exponential backoff

3. Environment Variables
   - Double-check .env file location
   - Verify variable names match exactly

4. Frontend-Backend Communication
   - Verify API endpoint URLs
   - Check network tab for request/response details

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License
[Add your license information here]