// server.js
// Import the Express library to create the server
const express = require('express');
// Create an instance of an Express application
const app = express();
// Import the API routes from the 'routes/api' file
const apiRoutes = require('./routes/api');
// Import the 'cors' middleware to enable Cross-Origin Resource Sharing
const cors = require('cors');
// Load environment variables from the '.env' file into 'process.env'
require('dotenv').config();
// Use the 'cors' middleware to allow cross-origin requests
app.use(cors());
// Use the 'express.json()' middleware to parse JSON bodies
app.use(express.json());
// Mount the API routes at the '/api' path
app.use('/api', apiRoutes);
// Define the port number (use the value from the environment variable 'PORT' or default to 5000)
const PORT = process.env.PORT || 5000;
// Start the server and listen on the specified port
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));