const express = require('express');
const cors = require('cors');
const path = require('path');
const Together = require('together-ai');
const { createPilot } = require('./utils/pilot');
const createChatRouter = require('./routes/chat');

function createApp(options = {}) {
const env = options.env || process.env;
const pilot = options.pilot || createPilot({ env });
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
const origins = (env.CHATBOT_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim()).filter(Boolean);

// Middleware
app.use(cors({ origin: origins, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
app.post('/api/auth/login', express.json({ limit: '2kb' }), (req, res) => {
  try { res.json(pilot.login(req.body.account, req.body.password, req.ip)); }
  catch (error) { res.status(error.status || 503).json({ error: error.message, code: error.code || 'login_setup' }); }
});

// Authentication covers the spending endpoint, files, history, and reports.
app.use('/api', pilot.requireAuth);
app.use('/public', pilot.requireAuth);
app.use('/api/files', express.json({ limit: '12mb' }));
app.use('/api', express.json({ limit: '128kb' }));
app.get('/api/auth/session', (req, res) => res.json({ user: { id: req.auth.id, label: req.auth.label } }));
app.post('/api/auth/logout', (req, res) => { pilot.logout(req.auth); res.json({ success: true }); });
app.get('/api/usage', async (req, res, next) => {
  try { res.json({ rows: await pilot.rows(req.auth.id), settings: pilot.settings }); }
  catch (error) { next(error); }
});
app.get('/api/usage.csv', async (req, res, next) => {
  try { res.type('text/csv').set('Content-Disposition', 'attachment; filename="aei-chatbot-usage.csv"').send(await pilot.csv(req.auth.id)); }
  catch (error) { next(error); }
});

let client;
const complete = options.complete || (async request => {
  if (!env.TOGETHER_API_KEY) throw Object.assign(new Error('The AI service is not connected yet.'), { status: 503, code: 'ai_setup' });
  client = client || new Together({ apiKey: env.TOGETHER_API_KEY, maxRetries: 0, timeout: 45000 });
  return client.chat.completions.create(request);
});

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/chat', createChatRouter({ pilot, complete, ...options.chatDependencies }));
app.use('/api/files', options.fileRoutes || require('./routes/files'));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', { name: error.name, code: error.code });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'The submitted content is too large.' });
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      error: 'File too large. Maximum size is 10MB per file.' 
    });
  }
  
  if ((error.message || '').includes('Only .txt files are allowed')) {
    return res.status(400).json({ 
      error: 'Invalid file type. Only .txt files are allowed.' 
    });
  }

  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl 
  });
});

app.locals.pilot = pilot;
return app;
}

if (require.main === module) {
  require('dotenv').config();
  const app = createApp();
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Private AEI chatbot listening on port ${port}`));
}

module.exports = { createApp };
