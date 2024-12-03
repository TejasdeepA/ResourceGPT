// routes/api.js
// Import the Express Router to create modular, mountable route handlers
const express = require('express');
const router = express.Router();
// Import 'axios' for making HTTP requests to external APIs
const axios = require('axios');
// Import OpenAI library
const { Configuration, OpenAIApi } = require('openai');
// Create OpenAI API configuration
const configuration = new Configuration({
 apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
// Import 'stackexchange' library for interacting with the Stack Exchange API
const stackexchange = require('stackexchange');
// Import 'nspell' for spell checking
const nspell = require('nspell');
// Manually provide a simple dictionary word list for nspell
const dictionary = `
 machine 1
 learning 1
 deep 1
 feature 1
 engineering 1
 computer 1
 science 1
 artificial 1
 intelligence 1
 etc 1
`;
// Create an instance of nspell with the basic dictionary
const spell = nspell(dictionary);
// =====================
// Function Definitions
// =====================
// Function to fetch resources from GitHub
async function fetchGitHubResources(query) {
 const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`;
 const response = await axios.get(url, {
 headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
 });
 return response.data.items.map((repo) => ({
 platform: 'GitHub',
 title: repo.full_name,
 description: repo.description,
 url: repo.html_url,
 }));
}
// Function to fetch resources from Reddit
async function fetchRedditResources(query) {
 const response = await axios.get(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=10`);
 return response.data.data.children.map((post) => ({
 platform: 'Reddit',
 title: post.data.title,
 description: post.data.selftext || 'No description available.',
 url: `https://www.reddit.com${post.data.permalink}`,
 }));
}
// Function to fetch resources from Stack Overflow
async function fetchStackOverflowResources(query) {
 const options = { version: 2.2 };
 const context = new stackexchange(options);
 const searchOptions = {
 order: 'desc',
 sort: 'votes',
 intitle: query,
 site: 'stackoverflow',
 };
 return new Promise((resolve, reject) => {
 context.questions.search(searchOptions, (err, results) => {
 if (err) reject(err);
 resolve(
 results.items.map((item) => ({
 platform: 'Stack Overflow',
 title: item.title,
 description: item.body_markdown || 'No description available.',
 url: item.link,
 }))
 );
 });
 });
}
// Function to fetch resources from YouTube with improved relevance
async function fetchYouTubeResources(query) {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  
  // Enhance query for educational content
  const educationalQuery = `${query} (course OR tutorial OR playlist OR complete guide)`;
  
  try {
    // First search for playlists
    const playlistResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(educationalQuery)}&type=playlist&maxResults=10&key=${YOUTUBE_API_KEY}`
    );

    // Then search for videos with longer duration
    const videoResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(educationalQuery)}&type=video&videoDuration=long&maxResults=10&key=${YOUTUBE_API_KEY}`
    );

    // Combine and process results
    const playlists = playlistResponse.data.items || [];
    const videos = videoResponse.data.items || [];
    
    // Get video durations and playlist details in parallel
    const videoIds = videos.map(item => item.id.videoId).join(',');
    const playlistIds = playlists.map(item => item.id.playlistId).join(',');
    
    const [videoDetails, playlistDetails] = await Promise.all([
      videoIds ? axios.get(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
      ) : { data: { items: [] } },
      playlistIds ? axios.get(
        `https://www.googleapis.com/youtube/v3/playlists?part=contentDetails,snippet&id=${playlistIds}&key=${YOUTUBE_API_KEY}`
      ) : { data: { items: [] } }
    ]);

    // Process playlists
    const processedPlaylists = playlists.map((item, index) => {
      const details = playlistDetails.data.items[index];
      return {
        platform: 'YouTube',
        type: 'playlist',
        title: item.snippet.title,
        description: item.snippet.description,
        url: `https://www.youtube.com/playlist?list=${item.id.playlistId}`,
        videoCount: details?.contentDetails?.itemCount || 0,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt
      };
    });

    // Process videos
    const processedVideos = videos.map((item, index) => {
      const details = videoDetails.data.items[index];
      return {
        platform: 'YouTube',
        type: 'video',
        title: item.snippet.title,
        description: item.snippet.description,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        duration: details?.contentDetails?.duration || 'N/A',
        views: parseInt(details?.statistics?.viewCount) || 0,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt
      };
    });

    // Filter and sort results
    const allResults = [...processedPlaylists, ...processedVideos]
      .filter(item => {
        // Filter out irrelevant content
        const relevanceScore = calculateYouTubeRelevance(item, query);
        return relevanceScore > 0.6;
      })
      .sort((a, b) => {
        // Prioritize playlists and longer content
        if (a.type !== b.type) return a.type === 'playlist' ? -1 : 1;
        if (a.type === 'playlist') return b.videoCount - a.videoCount;
        return b.views - a.views;
      })
      .slice(0, 10);

    return allResults;
  } catch (error) {
    console.error('Error fetching YouTube resources:', error);
    return [];
  }
}

// Helper function to calculate YouTube content relevance
function calculateYouTubeRelevance(item, query) {
  const queryWords = query.toLowerCase().split(' ');
  const titleWords = item.title.toLowerCase();
  const descWords = item.description.toLowerCase();
  
  let score = 0;
  
  // Check title relevance
  if (queryWords.every(word => titleWords.includes(word))) score += 0.4;
  else if (queryWords.some(word => titleWords.includes(word))) score += 0.2;
  
  // Check description relevance
  if (queryWords.every(word => descWords.includes(word))) score += 0.3;
  else if (queryWords.some(word => descWords.includes(word))) score += 0.1;
  
  // Bonus for educational indicators
  const educationalTerms = ['tutorial', 'course', 'learn', 'guide', 'complete', 'introduction', 'beginners'];
  if (educationalTerms.some(term => titleWords.includes(term))) score += 0.2;
  
  // Bonus for playlists with multiple videos
  if (item.type === 'playlist' && item.videoCount > 5) score += 0.1;
  
  return score;
}
// Function to check spelling and correct query
function correctSpelling(query) {
 const words = query.split(' ');
 const correctedWords = words.map(word => (spell.correct(word) ? word : spell.suggest(word)[0] || word));
 return correctedWords.join(' ');
}
// Function to extract keywords using OpenAI's GPT-3
async function extractKeywords(query) {
 try {
 const response = await openai.createCompletion({
 model: 'text-davinci-003',
 prompt: `Extract the main topics and keywords from this query: "${query}"`,
 max_tokens: 50,
 temperature: 0.5,
 });
 return response.data.choices[0].text.trim();
 } catch (error) {
 console.error('Error using OpenAI API:', error);
 return query; // Fallback to the original query in case of an error
 }
}
// =====================
// Route Definitions
// =====================
// Route to handle search requests
router.get('/search', async (req, res) => {
 let query = req.query.q;
 try {
 query = correctSpelling(query);
 query = await extractKeywords(query);
 const githubResources = await fetchGitHubResources(query);
 const redditResources = await fetchRedditResources(query);
 const stackOverflowResources = await fetchStackOverflowResources(query);
 const youtubeResources = await fetchYouTubeResources(query);
 const allResources = [...githubResources, ...redditResources, ...stackOverflowResources, ...youtubeResources];
 res.json(allResources);
 } catch (error) {
 res.status(500).json({ error: 'Error fetching resources' });
 }
});
module.exports = router;
