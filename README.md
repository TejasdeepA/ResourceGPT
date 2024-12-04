# ResourceGPT

A powerful resource aggregator that helps users find learning materials across multiple platforms including GitHub, YouTube, Reddit, Internet Archive, and FreeCodeCamp. Powered by AI for smart content ranking and relevance checking.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm (Node Package Manager)

## Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
GEMINI_API_KEY=your_gemini_api_key
GITHUB_TOKEN=your_github_token
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_SECRET=your_reddit_secret
YOUTUBE_API_KEY=your_youtube_api_key
FCC_API_KEY=your_fcc_api_key
```

## Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd ResourceGPT
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

## Running the Application

### Backend Server

1. Navigate to the backend directory:
```bash
cd backend
```

2. Start the server:
```bash
node server.js
```

The backend server will start running on `http://localhost:3000` (or your configured port).

### Frontend Server

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Start the development server:
```bash
npx http-server
```

The frontend will be available at `http://localhost:8080` (or the next available port).

## Features

- Multi-platform resource search across:
  - GitHub repositories
  - YouTube videos
  - Reddit posts
  - Internet Archive content
  - FreeCodeCamp articles and forum posts
- AI-powered content ranking using Google's Gemini
- Tag management system
- Content preview functionality
- Platform-specific filtering
- Responsive design

## API Integrations

The application integrates with multiple platforms. Make sure you have valid API keys for:
- Google Gemini AI
- GitHub API
- Reddit API
- YouTube API
- FreeCodeCamp API

## Contributing

This project was created for a hackathon. Feel free to submit issues and enhancement requests.

## License

[Your chosen license]
