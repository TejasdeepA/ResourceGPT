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
const FCC_API_KEY = process.env.FCC_API_KEY;

// API Endpoints
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const GITHUB_API_URL = 'https://api.github.com/search/repositories';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_SEARCH_URL = 'https://oauth.reddit.com/search';
const ARCHIVE_API_URL = 'https://archive.org/advancedsearch.php';
const FCC_NEWS_API = 'https://www.freecodecamp.org/news/ghost/api/v3/content/posts';
const FCC_FORUM_API = 'https://forum.freecodecamp.org/search.json';

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
    const query = keywords.join(' ');

    // Construct a more specific query for repositories
    const searchQuery = `${query} in:readme in:description language:javascript language:python language:java language:cpp language:html language:css`;
    
    const response = await axios.get(GITHUB_API_URL, {
      params: {
        q: searchQuery,
        sort: 'stars',
        order: 'desc',
        per_page: 50
      },
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${GITHUB_TOKEN}`
      }
    });

    if (!response.data?.items) {
      return [];
    }

    // Calculate repository relevance
    const calculateRepoRelevance = (repo) => {
      let score = 0;
      const repoText = [
        repo.name,
        repo.description,
        repo.topics?.join(' ') || ''
      ].join(' ').toLowerCase();

      // Keyword matching
      keywords.forEach(keyword => {
        if (repoText.includes(keyword.toLowerCase())) {
          score += 2;
          // Bonus for name/description matches
          if (repo.name.toLowerCase().includes(keyword.toLowerCase()) ||
              repo.description?.toLowerCase().includes(keyword.toLowerCase())) {
            score += 2;
          }
        }
      });

      // Quality indicators
      if (repo.stargazers_count > 100) score += 1;
      if (repo.stargazers_count > 1000) score += 2;
      if (repo.stargazers_count > 10000) score += 3;
      
      if (repo.forks_count > 50) score += 1;
      if (repo.forks_count > 500) score += 2;
      
      if (!repo.fork) score += 1; // Original repositories
      if (repo.homepage) score += 1; // Has documentation
      if (repo.topics?.length > 0) score += 1; // Well-tagged

      return score;
    };

    const results = await Promise.all(
      response.data.items
        .map(async repo => {
          const relevanceScore = calculateRepoRelevance(repo);
          if (relevanceScore < 4) return null; // Filter out low-relevance repos

          // Check content relevance
          const isRelevant = await checkGitHubRelevance(repo.full_name, originalQuery);
          if (!isRelevant) return null;

          return {
            title: repo.name,
            description: repo.description || 'No description available',
            url: repo.html_url,
            author: repo.owner.login,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            topics: repo.topics || [],
            platform: 'github',
            relevance: relevanceScore
          };
        })
    );

    return results
      .filter(Boolean)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20);

  } catch (error) {
    console.error('Error searching GitHub:', error);
    return [];
  }
}

// Function to search YouTube
async function searchYouTube(keywords, originalQuery) {
  try {
    console.log('Searching YouTube with keywords:', keywords);
    const query = keywords.join(' ');

    const response = await axios.get(YOUTUBE_API_URL, {
      params: {
        part: 'snippet',
        q: `${query} tutorial programming coding`,
        type: 'video',
        maxResults: 50,
        relevanceLanguage: 'en',
        videoType: 'any',
        key: YOUTUBE_API_KEY
      }
    });

    if (!response.data?.items) {
      return [];
    }

    // Get detailed video information
    const videoIds = response.data.items.map(item => item.id.videoId).join(',');
    const videoStats = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'statistics,contentDetails',
        id: videoIds,
        key: YOUTUBE_API_KEY
      }
    });

    const videoStatsMap = new Map(
      videoStats.data.items.map(item => [item.id, item])
    );

    // Calculate video relevance
    const calculateVideoRelevance = (video, stats) => {
      let score = 0;
      const videoText = [
        video.snippet.title,
        video.snippet.description,
        video.snippet.tags?.join(' ') || ''
      ].join(' ').toLowerCase();

      // Keyword matching
      keywords.forEach(keyword => {
        if (videoText.includes(keyword.toLowerCase())) {
          score += 2;
          // Bonus for title matches
          if (video.snippet.title.toLowerCase().includes(keyword.toLowerCase())) {
            score += 3;
          }
        }
      });

      // Quality indicators
      if (stats) {
        const viewCount = parseInt(stats.statistics.viewCount) || 0;
        const likeCount = parseInt(stats.statistics.likeCount) || 0;
        const commentCount = parseInt(stats.statistics.commentCount) || 0;

        if (viewCount > 1000) score += 1;
        if (viewCount > 10000) score += 1;
        if (viewCount > 100000) score += 1;

        if (likeCount > 100) score += 1;
        if (likeCount > 1000) score += 1;

        if (commentCount > 50) score += 1;
        
        // Engagement rate (likes/views)
        const engagementRate = viewCount > 0 ? (likeCount / viewCount) : 0;
        if (engagementRate > 0.01) score += 1;
        if (engagementRate > 0.05) score += 1;
      }

      // Channel verification
      if (video.snippet.channelTitle.includes('✓')) score += 1;

      // Educational indicators in title/description
      const educationalTerms = ['tutorial', 'course', 'learn', 'guide', 'introduction', 'beginners'];
      educationalTerms.forEach(term => {
        if (videoText.includes(term)) score += 1;
      });

      return score;
    };

    const results = response.data.items
      .map(video => {
        const stats = videoStatsMap.get(video.id.videoId);
        const relevanceScore = calculateVideoRelevance(video, stats);
        if (relevanceScore < 5) return null;

        return {
          title: video.snippet.title,
          description: video.snippet.description,
          url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
          thumbnail: video.snippet.thumbnails.high.url,
          channelTitle: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt,
          statistics: stats?.statistics || {},
          duration: stats?.contentDetails?.duration || '',
          platform: 'youtube',
          relevance: relevanceScore
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20);

    console.log(`Found ${results.length} relevant results from YouTube`);
    return results;

  } catch (error) {
    console.error('Error searching YouTube:', error);
    return [];
  }
}

// Function to search Reddit
async function searchReddit(keywords, originalQuery) {
  try {
    console.log('Searching Reddit with keywords:', keywords);
    const query = keywords.join(' ');
    
    const accessToken = await getRedditAccessToken();
    
    const response = await axios.get(REDDIT_SEARCH_URL, {
      params: {
        q: `${query} subreddit:programming OR subreddit:learnprogramming OR subreddit:coding OR subreddit:webdev OR subreddit:python OR subreddit:javascript`,
        sort: 'relevance',
        limit: 50,
        type: 'link,self',
        t: 'all'
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'ResourceGPT/1.0'
      }
    });

    if (!response.data?.data?.children) {
      return [];
    }

    // Calculate post relevance
    const calculatePostRelevance = async (post) => {
      let score = 0;
      const postText = [
        post.title,
        post.selftext,
        post.subreddit_name_prefixed
      ].join(' ').toLowerCase();

      // Keyword matching
      keywords.forEach(keyword => {
        if (postText.includes(keyword.toLowerCase())) {
          score += 2;
          // Bonus for title matches
          if (post.title.toLowerCase().includes(keyword.toLowerCase())) {
            score += 3;
          }
        }
      });

      // Quality indicators
      if (post.score > 10) score += 1;
      if (post.score > 100) score += 2;
      if (post.score > 1000) score += 3;

      if (post.num_comments > 5) score += 1;
      if (post.num_comments > 20) score += 2;
      if (post.num_comments > 100) score += 3;

      // Award bonus
      if (post.all_awardings?.length > 0) score += 1;

      // Educational subreddit bonus
      const educationalSubs = ['learnprogramming', 'programming', 'coding', 'webdev'];
      if (educationalSubs.some(sub => post.subreddit.toLowerCase().includes(sub))) {
        score += 2;
      }

      // Check content relevance
      const isRelevant = await checkRedditRelevance(post.url, originalQuery);
      if (isRelevant) score += 5;

      return score;
    };

    const results = await Promise.all(
      response.data.data.children
        .map(async ({ data: post }) => {
          const relevanceScore = await calculatePostRelevance(post);
          if (relevanceScore < 5) return null;

          return {
            title: post.title,
            description: post.selftext ? 
              (post.selftext.length > 300 ? post.selftext.substring(0, 300) + '...' : post.selftext) : 
              'No description available',
            url: `https://reddit.com${post.permalink}`,
            author: post.author,
            score: post.score,
            numComments: post.num_comments,
            subreddit: post.subreddit_name_prefixed,
            created: post.created_utc,
            platform: 'reddit',
            relevance: relevanceScore
          };
        })
    );

    return results
      .filter(Boolean)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20);

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
    
    // Construct a more specific query for educational content
    const educationalQuery = `${query} AND (mediatype:(texts OR movies OR education) AND format:(PDF OR MP4 OR AVI) AND collection:(opensource_movies OR inlibrary))`;
    
    const response = await axios.get(ARCHIVE_API_URL, {
      params: {
        q: educationalQuery,
        fl: ['identifier', 'title', 'description', 'creator', 'year', 'downloads', 
             'mediatype', 'subject', 'collection', 'language', 'format'].join(','),
        output: 'json',
        rows: 50, // Get more results initially for better filtering
        sort: '-downloads',
        page: 1
      }
    });

    if (!response.data?.response?.docs) {
      console.log('No results from Internet Archive');
      return [];
    }

    // Helper function to calculate relevance score
    const calculateRelevance = (item) => {
      let score = 0;
      const itemText = [
        item.title,
        item.description,
        Array.isArray(item.subject) ? item.subject.join(' ') : item.subject
      ].join(' ').toLowerCase();
      
      // Check for keyword matches
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (itemText.includes(keywordLower)) {
          score += 2;
          // Bonus for title matches
          if (item.title?.toLowerCase().includes(keywordLower)) {
            score += 3;
          }
        }
      });

      // Bonus for educational content
      if (item.collection?.includes('education') || 
          item.collection?.includes('inlibrary') ||
          item.collection?.includes('opensource_movies')) {
        score += 2;
      }

      // Bonus for popular content
      if (item.downloads > 1000) score += 1;
      if (item.downloads > 10000) score += 1;

      // Bonus for English content
      if (item.language === 'eng') score += 1;

      // Penalty for non-educational formats
      if (!['PDF', 'MP4', 'AVI'].includes(item.format)) {
        score -= 1;
      }

      return score;
    };

    // Filter and sort results by relevance
    const results = response.data.response.docs
      .map(item => ({
        ...item,
        relevanceScore: calculateRelevance(item)
      }))
      .filter(item => item.relevanceScore > 3) // Only keep relevant results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20) // Return top 20 most relevant results
      .map(item => ({
        title: item.title || 'No Title',
        description: item.description?.[0] || item.description || 'No description available',
        url: `https://archive.org/details/${item.identifier}`,
        author: item.creator ? (Array.isArray(item.creator) ? item.creator[0] : item.creator) : 'Unknown',
        year: item.year || 'N/A',
        downloads: item.downloads || 0,
        mediaType: item.mediatype || 'unknown',
        format: item.format || 'unknown',
        platform: 'archive',
        relevance: item.relevanceScore
      }));

    console.log(`Found ${results.length} relevant results from Internet Archive`);
    return results;
  } catch (error) {
    console.error('Error searching Internet Archive:', error);
    return [];
  }
}

// Function to search freeCodeCamp
async function searchFreeCodeCamp(keywords, originalQuery) {
  try {
    console.log('Searching freeCodeCamp courses with keywords:', keywords);
    
    // Define the course catalog structure with keywords for better matching
    const courseStructure = {
      'responsive-web-design': {
        title: '(New) Responsive Web Design Certification',
        description: 'Learn HTML and CSS fundamentals to design responsive websites',
        keywords: ['html', 'css', 'web', 'design', 'responsive', 'frontend', 'front-end', 'web development']
      },
      'javascript-algorithms-and-data-structures': {
        title: 'JavaScript Algorithms and Data Structures Certification',
        description: 'Learn JavaScript fundamentals, algorithms, and data structures',
        keywords: ['javascript', 'js', 'algorithms', 'data structures', 'programming', 'coding']
      },
      'front-end-development-libraries': {
        title: 'Front End Development Libraries Certification',
        description: 'Learn popular front-end libraries like Bootstrap, jQuery, React, and Redux',
        keywords: ['react', 'redux', 'bootstrap', 'jquery', 'sass', 'frontend', 'front-end', 'web', 'javascript']
      },
      'data-visualization': {
        title: 'Data Visualization Certification',
        description: 'Learn to visualize data with D3.js, JSON APIs, and AJAX',
        keywords: ['d3', 'data', 'visualization', 'charts', 'graphs', 'javascript', 'api']
      },
      'back-end-development-and-apis': {
        title: 'Back End Development and APIs Certification',
        description: 'Learn Node.js, Express, and MongoDB to create backend applications',
        keywords: ['node', 'nodejs', 'express', 'mongodb', 'backend', 'back-end', 'api', 'server']
      },
      'quality-assurance': {
        title: 'Quality Assurance Certification',
        description: 'Learn testing with Chai and advanced Node/Express integration',
        keywords: ['testing', 'qa', 'quality', 'assurance', 'chai', 'node', 'express', 'test']
      },
      'scientific-computing-with-python': {
        title: 'Scientific Computing with Python Certification',
        description: 'Learn Python fundamentals and scientific computing',
        keywords: ['python', 'scientific', 'computing', 'programming', 'coding']
      },
      'data-analysis-with-python': {
        title: 'Data Analysis with Python Certification',
        description: 'Learn data analysis with Python using NumPy, Pandas, and Matplotlib',
        keywords: ['python', 'data', 'analysis', 'numpy', 'pandas', 'matplotlib', 'analytics']
      },
      'information-security': {
        title: 'Information Security Certification',
        description: 'Learn information security and penetration testing',
        keywords: ['security', 'infosec', 'penetration', 'testing', 'python', 'cybersecurity']
      },
      'machine-learning-with-python': {
        title: 'Machine Learning with Python Certification',
        description: 'Learn machine learning fundamentals with TensorFlow',
        keywords: ['python', 'machine learning', 'ml', 'tensorflow', 'ai', 'artificial intelligence', 'data']
      }
    };

    const results = [];
    const searchTerms = keywords.map(k => k.toLowerCase());
    const originalQueryLower = originalQuery.toLowerCase();
    
    // Helper function to calculate relevance score
    const calculateRelevance = (course, courseSlug) => {
      let score = 0;
      
      // Check keywords match
      course.keywords.forEach(keyword => {
        if (searchTerms.some(term => keyword.includes(term) || term.includes(keyword))) {
          score += 2;
        }
      });
      
      // Check title match
      if (searchTerms.some(term => course.title.toLowerCase().includes(term))) {
        score += 2;
      }
      
      // Check description match
      if (searchTerms.some(term => course.description.toLowerCase().includes(term))) {
        score += 1;
      }
      
      // Bonus points for exact matches
      if (course.keywords.some(keyword => originalQueryLower.includes(keyword))) {
        score += 3;
      }
      
      return score;
    };

    // Find matching courses and calculate their relevance
    const matchingCourses = [];
    for (const [courseSlug, course] of Object.entries(courseStructure)) {
      const relevanceScore = calculateRelevance(course, courseSlug);
      
      // Only include courses with a minimum relevance score
      if (relevanceScore >= 2) {
        matchingCourses.push({
          ...course,
          slug: courseSlug,
          score: relevanceScore
        });
      }
    }

    // Sort by relevance score and convert to final format
    matchingCourses
      .sort((a, b) => b.score - a.score)
      .forEach(course => {
        results.push({
          title: course.title,
          description: course.description,
          url: `https://www.freecodecamp.org/learn/${course.slug}`,
          type: 'course',
          platform: 'freecodecamp',
          relevance: course.score
        });
      });

    console.log(`Found ${results.length} relevant courses from freeCodeCamp`);
    return results;
  } catch (error) {
    console.error('Error in freeCodeCamp search:', error);
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

    console.log('Received search request:', { query, platform });
    
    // Analyze query to extract keywords
    const keywords = await analyzeQuery(query);
    console.log('Extracted keywords:', keywords);

    const searchPromises = [];
    const results = { results: {} };

    // Add search promises based on selected platform
    if (platform === 'all' || platform === 'github') {
      searchPromises.push(searchGitHub(keywords, query));
    }
    if (platform === 'all' || platform === 'youtube') {
      searchPromises.push(searchYouTube(keywords, query));
    }
    if (platform === 'all' || platform === 'reddit') {
      searchPromises.push(searchReddit(keywords, query));
    }
    if (platform === 'all' || platform === 'archive') {
      searchPromises.push(searchArchive(keywords, query));
    }
    if (platform === 'all' || platform === 'freecodecamp') {
      searchPromises.push(searchFreeCodeCamp(keywords, query));
    }

    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);
    
    // Combine all results into a single array
    const allResults = searchResults.flat();
    
    // Rank results if we have more than 5
    let rankedResults = allResults;
    if (allResults.length > 5) {
      const rankedIndices = await rankResources(query, allResults);
      if (rankedIndices.length > 0) {
        rankedResults = rankedIndices.map(index => allResults[index]);
      }
    }

    // Send the final results
    res.json(rankedResults);

  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Error fetching resources' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
