const axios = require('axios');

// Minimum thresholds for resource quality
const MINIMUM_GITHUB_STARS = 3; // Lowered from 5 to get more results
const MINIMUM_REDDIT_UPVOTES = 5; // Lowered from 10 to get more results
const MINIMUM_README_LENGTH = 50; // Lowered from 100 to get more results
const RELEVANCE_THRESHOLD = 0.5; // Lowered from 0.6 to get more results

// Function to check if content matches query semantically using Gemini
async function checkSemanticRelevance(query, content, geminiApiKey) {
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
            {
                contents: [{
                    parts: [{
                        text: `Analyze if this content is relevant to the query "${query}". Content: "${content}". Return only a number between 0 and 1 representing relevance score.`
                    }]
                }]
            }
        );
        const score = parseFloat(response.data.candidates[0].content.parts[0].text);
        return !isNaN(score) ? score : 0;
    } catch (error) {
        console.error('Error checking semantic relevance:', error);
        return 0;
    }
}

// Function to check GitHub repository relevance
async function checkGitHubRelevance(repo, query, geminiApiKey) {
    try {
        // Basic quality checks with more lenient criteria for newer repos
        const repoAge = new Date() - new Date(repo.created_at);
        const isNewRepo = repoAge < 1000 * 60 * 60 * 24 * 90; // 90 days
        
        if (!isNewRepo && repo.stargazers_count < MINIMUM_GITHUB_STARS) {
            return false;
        }

        // Get README content
        const readmeResponse = await axios.get(`https://api.github.com/repos/${repo.full_name}/readme`, {
            headers: {
                'Accept': 'application/vnd.github.v3.raw',
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
            }
        });
        const readmeContent = readmeResponse.data;

        if (readmeContent.length < MINIMUM_README_LENGTH) {
            return false;
        }

        // Check semantic relevance
        const relevanceScore = await checkSemanticRelevance(
            query,
            `${repo.description}\n${readmeContent.substring(0, 1500)}`, // Increased from 1000 to get better context
            geminiApiKey
        );

        // Check if repository has relevant topics
        const hasRelevantTopics = repo.topics && repo.topics.some(topic => 
            query.toLowerCase().includes(topic.toLowerCase()) ||
            topic.toLowerCase().includes(query.toLowerCase())
        );

        // More lenient scoring for repos with good documentation
        const hasGoodDocumentation = readmeContent.length > 500;
        const effectiveThreshold = hasGoodDocumentation ? RELEVANCE_THRESHOLD * 0.9 : RELEVANCE_THRESHOLD;

        return relevanceScore >= effectiveThreshold || hasRelevantTopics;
    } catch (error) {
        console.error('Error checking GitHub relevance:', error);
        return true; // More lenient - include result if check fails
    }
}

// Function to check Reddit post relevance
async function checkRedditRelevance(post, query, geminiApiKey) {
    try {
        // Basic quality checks with consideration for newer posts
        const postAge = new Date() - new Date(post.data.created_utc * 1000);
        const isNewPost = postAge < 1000 * 60 * 60 * 24 * 7; // 7 days
        
        if (!isNewPost && post.data.ups < MINIMUM_REDDIT_UPVOTES) {
            return false;
        }

        // Check if post is from relevant programming subreddits
        const relevantSubreddits = [
            'programming', 'learnprogramming', 'coding', 'webdev',
            'javascript', 'python', 'java', 'cpp', 'csharp',
            'machinelearning', 'datascience', 'computerscience',
            'learnjavascript', 'learnpython', 'learnjava', 'webdevelopment',
            'frontend', 'backend', 'fullstack', 'devops', 'coding',
            'technology', 'tech', 'softwareengineering', 'compsci'
        ];
        
        const isRelevantSubreddit = relevantSubreddits.some(sub => 
            post.data.subreddit.toLowerCase().includes(sub)
        );

        // Get post content
        const content = `${post.data.title}\n${post.data.selftext}`;
        
        // Check semantic relevance
        const relevanceScore = await checkSemanticRelevance(query, content, geminiApiKey);

        // More lenient criteria for high-quality posts
        const isHighQualityPost = post.data.ups >= MINIMUM_REDDIT_UPVOTES * 3 || 
                                 post.data.num_comments >= 10;

        return (relevanceScore >= RELEVANCE_THRESHOLD) || 
               (isRelevantSubreddit && (isHighQualityPost || isNewPost));
    } catch (error) {
        console.error('Error checking Reddit relevance:', error);
        return true; // More lenient - include result if check fails
    }
}

module.exports = {
    checkGitHubRelevance,
    checkRedditRelevance,
    checkSemanticRelevance
};
