const express = require('express');
const multer = require('multer');
const TxtKnowledgeBase = require('../utils/knowledgeBase');

const router = express.Router();
const safeDomain = value => typeof value === 'string' && /^[A-Za-z0-9 _-]{1,80}$/.test(value);
const safeFilename = value => typeof value === 'string' && value.length <= 240 && value.endsWith('.txt') && !/[\\/\x00-\x1f]/.test(value) && !value.startsWith('.');
router.param('domainName', (req, res, next, value) => safeDomain(value) ? next() : res.status(400).json({ error: 'Invalid scholar folder.' }));
router.param('filename', (req, res, next, value) => safeFilename(value) ? next() : res.status(400).json({ error: 'Invalid text filename.' }));

// Initialize knowledge base
const kb = new TxtKnowledgeBase();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (safeFilename(file.originalname) && (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt'))) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5,
    fields: 10,
    parts: 15
  }
});

// Get available domains
router.get('/domains', async (req, res) => {
  try {
    const domains = await kb.getAvailableDomains();
    res.json(domains);
  } catch (error) {
    console.error('Error getting domains:', error);
    res.status(500).json({ error: 'Failed to get domains' });
  }
});

// Create new domain (scholar folder)
router.post('/domains', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!safeDomain(name)) {
      return res.status(400).json({ error: 'Domain name is required' });
    }

    const success = await kb.createDomain(name.trim(), description);
    
    if (!success) {
      return res.status(400).json({ error: 'Domain already exists or invalid name' });
    }

    res.json({ 
      success: true, 
      message: `Domain "${name}" created successfully` 
    });
  } catch (error) {
    console.error('Create domain error:', error);
    res.status(500).json({ 
      error: 'Failed to create domain',
      details: error.message 
    });
  }
});

// Delete domain
router.delete('/domains/:domainName', async (req, res) => {
  try {
    const { domainName } = req.params;
    const success = await kb.deleteDomain(domainName);
    
    if (!success) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    res.json({ 
      success: true, 
      message: `Domain "${domainName}" deleted successfully` 
    });
  } catch (error) {
    console.error('Delete domain error:', error);
    res.status(500).json({ 
      error: 'Failed to delete domain',
      details: error.message 
    });
  }
});

// Upload files to domain
router.post('/upload/:domainName', upload.array('files'), async (req, res) => {
  try {
    const { domainName } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    
    for (const file of files) {
      const content = file.buffer.toString('utf8');
      const success = await kb.saveDomainFile(domainName, file.originalname, content);
      
      results.push({
        filename: file.originalname,
        success,
        size: file.size
      });
    }

    res.json({
      message: `Uploaded ${results.length} files to ${domainName}`,
      results
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload files',
      details: error.message 
    });
  }
});

// Get domain content (files list)
router.get('/content/:domainName', async (req, res) => {
  try {
    const { domainName } = req.params;
    const content = await kb.loadDomainContent(domainName);
    res.json(content);
  } catch (error) {
    console.error('Error getting domain content:', error);
    res.status(500).json({ error: 'Failed to get domain content' });
  }
});

// Get specific file content
router.get('/content/:domainName/:filename', async (req, res) => {
  try {
    const { domainName, filename } = req.params;
    const fileContent = await kb.getFileContent(domainName, filename);
    
    if (fileContent === null) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ 
      filename, 
      content: fileContent,
      domain: domainName 
    });
  } catch (error) {
    console.error('Error getting file content:', error);
    res.status(500).json({ error: 'Failed to get file content' });
  }
});

// Update file content
router.put('/content/:domainName/:filename', async (req, res) => {
  try {
    const { domainName, filename } = req.params;
    const { content } = req.body;

    if (content === undefined || content === null) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const success = await kb.updateFileContent(domainName, filename, content);
    
    if (!success) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ 
      success: true,
      message: `File "${filename}" updated successfully` 
    });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ 
      error: 'Failed to update file',
      details: error.message 
    });
  }
});

// Delete file
router.delete('/content/:domainName/:filename', async (req, res) => {
  try {
    const { domainName, filename } = req.params;
    const success = await kb.deleteFile(domainName, filename);
    
    if (!success) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ 
      success: true,
      message: `File "${filename}" deleted successfully` 
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ 
      error: 'Failed to delete file',
      details: error.message 
    });
  }
});

// Get file statistics
router.get('/stats/:domainName', async (req, res) => {
  try {
    const { domainName } = req.params;
    const stats = await kb.getDomainStats(domainName);
    
    if (!stats) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get domain statistics',
      details: error.message 
    });
  }
});

// Search files across domains
router.get('/search', async (req, res) => {
  try {
    const { q: query, domain } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const results = await kb.searchAcrossDomains(query.trim(), domain);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Failed to search files',
      details: error.message 
    });
  }
});

// Bulk operations
router.post('/bulk', async (req, res) => {
  try {
    const { operation, domain, files } = req.body;
    
    if (!operation || !safeDomain(domain) || !Array.isArray(files) || files.length > 100 || !files.every(safeFilename)) {
      return res.status(400).json({ 
        error: 'Operation, domain, and files array are required' 
      });
    }

    let results = [];

    switch (operation) {
      case 'delete':
        for (const filename of files) {
          const success = await kb.deleteFile(domain, filename);
          results.push({ filename, success });
        }
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid operation' });
    }

    res.json({
      operation,
      domain,
      results,
      success: results.every(r => r.success)
    });
  } catch (error) {
    console.error('Bulk operation error:', error);
    res.status(500).json({ 
      error: 'Failed to perform bulk operation',
      details: error.message 
    });
  }
});

module.exports = router;
