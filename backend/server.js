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
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const GITHUB_API_URL = 'https://api.github.com/search/repositories';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_SEARCH_URL = 'https://oauth.reddit.com/search';

// Function to get Reddit access token
async function getRedditAccessToken() {
  try {
    const response = await axios.post(REDDIT_TOKEN_URL, 
      'grant_type=client_credentials',
      {
        auth: {
          username: REDDIT_CLIENT_ID,
          password: REDDIT_SECRET
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Reddit token:', error);
    throw error;
  }
}

// Function to analyze query with Gemini
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

// Function to search GitHub
async function searchGitHub(keywords) {
  try {
    const query = keywords.join('+');
    const response = await axios.get(`${GITHUB_API_URL}?q=${query}&sort=stars`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    return response.data.items.slice(0, 5).map(repo => ({
      type: 'github',
      title: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count
    }));
  } catch (error) {
    console.error('Error searching GitHub:', error);
    return [];
  }
}

// Function to search YouTube
async function searchYouTube(keywords) {
  try {
    const query = keywords.join(' ');
    const response = await axios.get(YOUTUBE_API_URL, {
      params: {
        part: 'snippet',
        q: query,
        key: YOUTUBE_API_KEY,
        type: 'video',
        maxResults: 5
      }
    });
    return response.data.items.map(item => ({
      type: 'youtube',
      title: item.snippet.title,
      description: item.snippet.description,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails.default.url
    }));
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return [];
  }
}

// Function to search Reddit
async function searchReddit(keywords) {
  try {
    const token = await getRedditAccessToken();
    const query = keywords.join(' ');
    const response = await axios.get(REDDIT_SEARCH_URL, {
      params: {
        q: query,
        limit: 5,
        sort: 'relevance',
        t: 'all',
        restrict_sr: 'programming'
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.data.children.map(post => ({
      type: 'reddit',
      title: post.data.title,
      description: post.data.selftext.substring(0, 200),
      url: `https://reddit.com${post.data.permalink}`,
      score: post.data.score
    }));
  } catch (error) {
    console.error('Error searching Reddit:', error);
    return [];
  }
}

// Main search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Analyze query with Gemini to extract relevant keywords
    const keywords = await analyzeQuery(query);

    // Fetch results from all platforms concurrently
    const [githubResults, redditResults, youtubeResults] = await Promise.all([
      searchGitHub(keywords),
      searchReddit(keywords),
      searchYouTube(keywords)
    ]);

    // Combine and send results
    res.json({
      keywords,
      results: {
        github: githubResults,
        reddit: redditResults,
        youtube: youtubeResults
      }
    });
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
