const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import UUID package
const { v4: uuidv4 } = require('uuid');

const chatRoutes = require('./routes/chat');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'AEI Chatbot Backend is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      error: 'File too large. Maximum size is 10MB per file.' 
    });
  }
  
  if (error.message.includes('Only .txt files are allowed')) {
    return res.status(400).json({ 
      error: 'Invalid file type. Only .txt files are allowed.' 
    });
  }

  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Knowledge Base: ${path.resolve('knowledge_base')}`);
  console.log(`Chat Storage: ${path.resolve('chats')}`);
  console.log(`API Health: http://localhost:${PORT}/api/health`);
});
