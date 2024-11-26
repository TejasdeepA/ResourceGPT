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
 const allResources = [...githubResources, ...redditResources, ...stackOverflowResources];
 res.json(allResources);
 } catch (error) {
 res.status(500).json({ error: 'Error fetching resources' });
 }
});
module.exports = router;
