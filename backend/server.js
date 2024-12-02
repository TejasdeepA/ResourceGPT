const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { checkGitHubRelevance, checkRedditRelevance } = require('./utils/relevanceChecker');
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

// Function to rank resources using Gemini
async function rankResources(query, resources) {
  try {
    const prompt = `Given the search query "${query}", rank these resources based on their relevance, quality, and educational value. 
    Consider factors like: content depth, reliability of source, relevance to query, and potential learning value.
    Return only a JSON array of indices (0-based) for the top 5 most valuable resources, ordered from best to worst.
    Resources to rank:
    ${resources.map((r, i) => `${i}. Title: ${r.title}\nDescription: ${r.description}\n`).join('\n')}`;

    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const rankingText = response.data.candidates[0].content.parts[0].text;
    // Extract array from the response text using regex
    const match = rankingText.match(/\[(.*?)\]/);
    if (match) {
      return JSON.parse(match[0])
        .slice(0, 5) // Ensure we only get top 5
        .filter(index => index < resources.length); // Ensure valid indices
    }
    return [];
  } catch (error) {
    console.error('Error ranking resources:', error);
    return []; // Return empty array on error
  }
}

// Function to search GitHub
async function searchGitHub(keywords, originalQuery) {
  try {
    const query = keywords.join('+');
    const response = await axios.get(`${GITHUB_API_URL}?q=${query}&sort=stars&per_page=50`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    // Filter and check relevance for each repository
    const relevantRepos = [];
    for (const repo of response.data.items) {
      if (await checkGitHubRelevance(repo, originalQuery, GEMINI_API_KEY)) {
        relevantRepos.push({
          type: 'github',
          title: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          stars: repo.stargazers_count,
          topics: repo.topics || [],
          created_at: repo.created_at,
          language: repo.language,
          forks: repo.forks_count
        });
      }
      if (relevantRepos.length >= 15) break; // Increased from 5 to 15
    }
    return relevantRepos;
  } catch (error) {
    console.error('Error searching GitHub:', error);
    return [];
  }
}

// Function to search YouTube
async function searchYouTube(keywords) {
  try {
    const query = keywords.join(' ');
    const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 15, // Increased from 10
        key: process.env.YOUTUBE_API_KEY,
        relevanceLanguage: 'en',
        videoType: 'any',
        order: 'relevance'
      }
    });

    // Get video statistics in a separate call
    const videoIds = response.data.items.map(item => item.id.videoId).join(',');
    const statsResponse = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
      params: {
        part: 'statistics,contentDetails',
        id: videoIds,
        key: process.env.YOUTUBE_API_KEY
      }
    });

    // Create a map of video stats
    const videoStats = {};
    statsResponse.data.items.forEach(item => {
      videoStats[item.id] = {
        ...item.statistics,
        duration: item.contentDetails.duration
      };
    });

    return response.data.items.map(item => ({
      title: item.snippet.title,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      description: truncateText(item.snippet.description, 150),
      thumbnail: item.snippet.thumbnails.default.url,
      views: videoStats[item.id.videoId]?.viewCount || 0,
      likes: videoStats[item.id.videoId]?.likeCount || 0,
      duration: videoStats[item.id.videoId]?.duration || '',
      publishedAt: item.snippet.publishedAt,
      type: 'youtube'
    }));
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return [];
  }
}

// Function to search Reddit
async function searchReddit(keywords, originalQuery) {
  try {
    const query = keywords.join(' ');
    const token = await getRedditAccessToken();
    const response = await axios.get(REDDIT_SEARCH_URL, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ResourceGPT/1.0'
      },
      params: {
        q: query,
        limit: 50,
        sort: 'relevance',
        type: 'link,self',
        t: 'year' // Include content from the past year
      }
    });

    // Filter and check relevance for each post
    const relevantPosts = [];
    for (const post of response.data.data.children) {
      if (await checkRedditRelevance(post, originalQuery, GEMINI_API_KEY)) {
        relevantPosts.push({
          title: post.data.title,
          url: `https://reddit.com${post.data.permalink}`,
          description: truncateText(post.data.selftext || 'No description available', 150),
          upvotes: post.data.ups,
          subreddit: post.data.subreddit,
          type: 'reddit',
          created_utc: post.data.created_utc,
          num_comments: post.data.num_comments,
          score: post.data.score
        });
      }
      if (relevantPosts.length >= 15) break; // Increased from 5 to 15
    }
    return relevantPosts;
  } catch (error) {
    console.error('Error searching Reddit:', error);
    return [];
  }
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength) + '...';
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
      searchGitHub(keywords, query),
      searchReddit(keywords, query),
      searchYouTube(keywords)
    ]);

    // Combine all results
    const allResults = {
      github: githubResults,
      reddit: redditResults,
      youtube: youtubeResults
    };

    res.json({ results: allResults });
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
