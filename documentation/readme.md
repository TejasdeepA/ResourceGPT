# ResourceGPT

An AI-powered learning resource aggregator that helps developers find the best educational content across multiple platforms.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Step-by-Step Build Guide](#step-by-step-build-guide)
- [API Integration](#api-integration)
- [Contributing](#contributing)
- [License](#license)

## Overview

ResourceGPT uses AI to understand your programming queries and finds the most relevant learning resources from:
- GitHub (code examples & projects)
- YouTube (video tutorials)
- Reddit (community discussions)

The AI analyzes and ranks resources based on:
- Content relevance
- Difficulty level
- Learning outcomes
- Community engagement
- Educational value

## Features

- 🔍 AI-powered search understanding
- 🎯 Multi-platform resource aggregation
- 📊 Smart content ranking
- 📝 Detailed resource analysis
- 🎨 Clean, responsive UI

## Prerequisites

Before you begin, ensure you have:

1. Node.js (v14 or higher)
2. npm (v6 or higher)
3. API Keys for:
   - Google Gemini API
   - GitHub API
   - YouTube Data API
   - Reddit API (Client ID & Secret)

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ResourceGPT.git
   cd ResourceGPT
   ```

2. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Create .env file in the backend directory
   cd backend
   cp .env.example .env
   ```
   
   Add your API keys to `.env`:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   GITHUB_TOKEN=your_github_token
   REDDIT_CLIENT_ID=your_reddit_client_id
   REDDIT_SECRET=your_reddit_secret
   YOUTUBE_API_KEY=your_youtube_api_key
   ```

4. Start the servers:
   ```bash
   # Start backend (from backend directory)
   npm start

   # Start frontend (from frontend directory)
   npx http-server
   ```

5. Open http://localhost:8081 in your browser

## Project Structure

```
ResourceGPT/
├── backend/
│   ├── server.js          # Main server file
│   └── package.json       # Backend dependencies
├── frontend/
│   ├── index.html         # Main HTML file
│   ├── scripts/
│   │   └── script.js      # Frontend JavaScript
│   └── styles/
│       ├── styles.css     # Main styles
│       ├── SearchBar.css  # Search component styles
│       └── ResourceList.css # Resource list styles
└── documentation/
    └── readme.md          # Project documentation
```

## Step-by-Step Build Guide

### 1. Setting Up the Backend

1. Create the Express server (`backend/server.js`):
   ```javascript
   const express = require('express');
   const app = express();
   // ... (see server.js for full code)
   ```

2. Implement API integrations:
   - Gemini for query analysis
   - GitHub for repository search
   - YouTube for video search
   - Reddit for community discussions

3. Create search endpoint:
   ```javascript
   app.get('/api/search', async (req, res) => {
     // ... (see server.js for full code)
   });
   ```

### 2. Building the Frontend

1. Create the HTML structure (`frontend/index.html`):
   - Search input
   - Filter buttons
   - Resource list container

2. Style the components:
   - Modern search bar
   - Resource cards
   - Responsive layout

3. Implement JavaScript functionality:
   - Search handling
   - Resource filtering
   - Dynamic content loading

### 3. Implementing AI Analysis

1. Query understanding:
   ```javascript
   async function analyzeQuery(query) {
     // Use Gemini to extract key concepts
   }
   ```

2. Resource analysis:
   ```javascript
   async function analyzeResourcesInDetail(resources) {
     // Analyze difficulty, topics, prerequisites
   }
   ```

## API Integration

### 1. Gemini API
- Used for: Query analysis & resource evaluation
- Setup: Add GEMINI_API_KEY to .env

### 2. GitHub API
- Used for: Finding code repositories
- Setup: Add GITHUB_TOKEN to .env

### 3. YouTube API
- Used for: Finding video tutorials
- Setup: Add YOUTUBE_API_KEY to .env

### 4. Reddit API
- Used for: Finding community discussions
- Setup: Add REDDIT_CLIENT_ID and REDDIT_SECRET to .env

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.