const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { checkGitHubRelevance, checkRedditRelevance } = require('./utils/relevanceChecker');
const { addTag, getResourceTags, removeTag } = require('./utils/tagManager');
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
const ARCHIVE_API_URL = 'https://archive.org/advancedsearch.php';

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
    console.log('Searching GitHub with keywords:', keywords);
    const query = encodeURIComponent(keywords.join(' '));
    const response = await axios.get(`${GITHUB_API_URL}?q=${query}&sort=stars&per_page=15`, {
      headers: GITHUB_TOKEN ? {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      } : {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    console.log(`Found ${response.data.items.length} GitHub repositories`);
    
    // Map repositories directly without relevance check due to rate limit
    const repos = response.data.items.map(repo => ({
      type: 'github',
      title: repo.full_name,
      description: repo.description || 'No description available',
      url: repo.html_url,
      stars: repo.stargazers_count,
      topics: repo.topics || [],
      language: repo.language,
      forks: repo.forks_count
    }));

    return repos.slice(0, 15);
  } catch (error) {
    console.error('Error searching GitHub:', error.response?.data || error.message);
    return [];
  }
}

// Function to search YouTube
async function searchYouTube(keywords) {
  try {
    console.log('Searching YouTube with keywords:', keywords);
    const query = encodeURIComponent(keywords.join(' '));
    
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 15,
        key: YOUTUBE_API_KEY,
        relevanceLanguage: 'en',
        order: 'relevance'
      }
    });

    console.log(`Found ${response.data.items.length} YouTube videos`);

    // Map videos directly without additional stats to avoid rate limits
    return response.data.items.map(item => ({
      type: 'youtube',
      title: item.snippet.title,
      description: item.snippet.description ? truncateText(item.snippet.description, 150) : '',
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails.medium.url,
      publishedAt: item.snippet.publishedAt
    }));
  } catch (error) {
    console.error('Error searching YouTube:', error.response?.data || error.message);
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

// Function to search Internet Archive
async function searchArchive(keywords, originalQuery) {
  try {
    console.log('Searching Internet Archive with keywords:', keywords);
    const query = keywords.join(' ');
    
    const response = await axios.get(ARCHIVE_API_URL, {
      params: {
        q: query,
        fl: 'identifier,title,description,creator,year,downloads,mediatype',
        output: 'json',
        rows: 20,
        sort: '-downloads',
        page: 1
      }
    });

    console.log('Internet Archive API Response:', JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.response || !response.data.response.docs) {
      console.log('No results from Internet Archive');
      return [];
    }

    const results = response.data.response.docs.map(item => ({
      title: item.title || 'No Title',
      description: item.description || 'No description available',
      url: `https://archive.org/details/${item.identifier}`,
      author: item.creator ? (Array.isArray(item.creator) ? item.creator[0] : item.creator) : 'Unknown',
      year: item.year || 'N/A',
      downloads: item.downloads || 0,
      mediaType: item.mediatype || 'unknown',
      platform: 'archive'
    }));

    console.log(`Found ${results.length} results from Internet Archive`);
    return results;
  } catch (error) {
    console.error('Error searching Internet Archive:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return [];
  }
}

// Function to get content preview
async function getContentPreview(url, source) {
    try {
        console.log(`Fetching preview for ${url} from ${source}`);
        
        if (source === 'youtube') {
            const videoId = url.split('v=')[1]?.split('&')[0];
            if (!videoId) {
                throw new Error('Invalid YouTube URL');
            }
            
            const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
                params: {
                    part: 'snippet',
                    id: videoId,
                    key: YOUTUBE_API_KEY
                }
            });
            
            if (!response.data.items || response.data.items.length === 0) {
                throw new Error('Video not found');
            }
            
            const video = response.data.items[0];
            return {
                title: video.snippet.title,
                summary: video.snippet.description?.slice(0, 200) + '...'
            };
        } 
        else if (source === 'github') {
            const repoPath = url.split('github.com/')[1];
            if (!repoPath) {
                throw new Error('Invalid GitHub URL');
            }
            
            const response = await axios.get(`https://api.github.com/repos/${repoPath}`, {
                headers: GITHUB_TOKEN ? { 
                    Authorization: `token ${GITHUB_TOKEN}` 
                } : {}
            });
            
            return {
                title: response.data.full_name,
                summary: response.data.description || 'No description available'
            };
        }
        else if (source === 'reddit') {
            const postId = url.split('comments/')[1]?.split('/')[0];
            if (!postId) {
                throw new Error('Invalid Reddit URL');
            }
            
            const token = await getRedditAccessToken();
            const response = await axios.get(`https://oauth.reddit.com/api/info?id=t3_${postId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'User-Agent': 'ResourceGPT/1.0.0'
                }
            });
            
            if (!response.data.data.children || response.data.data.children.length === 0) {
                throw new Error('Reddit post not found');
            }
            
            const post = response.data.data.children[0].data;
            return {
                title: post.title,
                summary: post.selftext 
                    ? post.selftext.slice(0, 200) + '...' 
                    : 'No content available'
            };
        }
        
        return {
            title: 'Preview',
            summary: 'Preview not available for this type of content'
        };
    } catch (error) {
        console.error('Error getting content preview:', error.message);
        throw new Error(`Failed to load preview: ${error.message}`);
    }
}

// Preview endpoint
app.post('/api/preview', async (req, res) => {
    try {
        const { url, source } = req.body;
        console.log('Preview request received:', { url, source });
        
        if (!url) {
            return res.status(400).json({ 
                error: 'URL is required',
                message: 'Please provide a valid URL'
            });
        }
        
        const preview = await getContentPreview(url, source);
        console.log('Preview generated successfully:', preview);
        res.json(preview);
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ 
            error: 'Failed to get preview',
            message: error.message || 'An unexpected error occurred'
        });
    }
});

// Tag management endpoints
app.post('/api/tags', async (req, res) => {
    try {
        const { resourceId, tag } = req.body;
        if (!resourceId || !tag) {
            return res.status(400).json({ error: 'Resource ID and tag are required' });
        }
        
        const result = addTag(resourceId, tag);
        res.json(result);
    } catch (error) {
        console.error('Error adding tag:', error);
        res.status(500).json({ error: 'Failed to add tag' });
    }
});

app.get('/api/tags/:resourceId', async (req, res) => {
    try {
        const { resourceId } = req.params;
        const result = getResourceTags(resourceId);
        res.json(result);
    } catch (error) {
        console.error('Error getting tags:', error);
        res.status(500).json({ error: 'Failed to get tags' });
    }
});

app.delete('/api/tags/:resourceId/:tag', async (req, res) => {
    try {
        const { resourceId, tag } = req.params;
        const result = removeTag(resourceId, tag);
        res.json(result);
    } catch (error) {
        console.error('Error removing tag:', error);
        res.status(500).json({ error: 'Failed to remove tag' });
    }
});

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength) + '...';
}

// Main search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { query, platform } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const keywords = await analyzeQuery(query);
    const results = { query };

    // Parallel search based on selected platform
    const searchPromises = [];
    if (platform === 'all' || platform === 'github') {
      searchPromises.push(searchGitHub(keywords, query).then(data => ({ github: data })));
    }
    if (platform === 'all' || platform === 'youtube') {
      searchPromises.push(searchYouTube(keywords).then(data => ({ youtube: data })));
    }
    if (platform === 'all' || platform === 'reddit') {
      searchPromises.push(searchReddit(keywords, query).then(data => ({ reddit: data })));
    }
    if (platform === 'all' || platform === 'archive') {
      searchPromises.push(searchArchive(keywords, query).then(data => ({ archive: data })));
    }

    const searchResults = await Promise.all(searchPromises);
    results.results = searchResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'An error occurred during search' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
