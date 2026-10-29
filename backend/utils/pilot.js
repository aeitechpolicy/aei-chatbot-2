const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { PostgresStorage } = require('../storage/postgres');

const MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
const MAX_OUTPUT_TOKENS = 1024;
const MAX_INPUT_BYTES = 120000;
const MAX_QUESTION_CHARS = 6000;

function positiveNumber(value, fallback) {
  const n = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Pilot limits and prices must be positive numbers.');
  return n;
}

function failure(message, status = 429, code = 'usage_limit') {
  return Object.assign(new Error(message), { status, code });
}

function createPilot({ env = process.env, now = Date.now, dataDir, storage } = {}) {
  const root = path.resolve(dataDir || env.CHATBOT_DATA_DIR || path.join(__dirname, '../.private-data'));
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const remote = storage || (env.DATABASE_URL ? new PostgresStorage({ connectionString: env.DATABASE_URL, now }) : null);
  const db = remote ? null : new DatabaseSync(path.join(root, 'usage.sqlite'));
  if (db) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS usage (
    id TEXT PRIMARY KEY, started_at TEXT NOT NULL, user_id TEXT NOT NULL,
    model TEXT NOT NULL, status TEXT NOT NULL, reserved_usd REAL NOT NULL,
    estimated_usd REAL, input_tokens INTEGER, output_tokens INTEGER,
    input_rate REAL NOT NULL, output_rate REAL NOT NULL, price_source TEXT NOT NULL,
    error_code TEXT
  ); CREATE INDEX IF NOT EXISTS usage_started ON usage(started_at);`);
  }

  // These defaults reproduce the user's October 2026 Llama billing rate.
  // They are estimates, not a promise of Together's current billing price.
  const inputRate = positiveNumber(env.CHATBOT_INPUT_USD_PER_MILLION, 1.04);
  const outputRate = positiveNumber(env.CHATBOT_OUTPUT_USD_PER_MILLION, 1.04);
  const dailyBudget = positiveNumber(env.CHATBOT_DAILY_ESTIMATE_USD, 0.50);
  const dailyQuestions = Math.floor(positiveNumber(env.CHATBOT_DAILY_QUESTIONS, 50));
  const personQuestions = Math.floor(positiveNumber(env.CHATBOT_PERSON_DAILY_QUESTIONS, 30));
  const priceSource = env.CHATBOT_PRICE_SOURCE || 'October 2026 AEI billing export; confirm current rate before live use';
  const accounts = new Map();
  let setupError = null;
  for (const [id, label, password] of [
    ['owner', 'Chatbot Intern', env.CHATBOT_INTERN_PASSWORD],
    ['supervisor', 'Chatbot RA', env.CHATBOT_RA_PASSWORD]
  ]) {
    if (!password) continue;
    if (password.length < 16 || password.length > 256) {
      setupError = 'Each configured login password must contain 16 to 256 characters.';
      continue;
    }
    const salt = crypto.randomBytes(16);
    accounts.set(id, { id, label, salt, hash: crypto.scryptSync(password, salt, 32) });
  }
  if (!accounts.has('owner')) setupError = setupError || 'The Chatbot Intern login has not been configured.';
  if (env.CHATBOT_INTERN_PASSWORD && env.CHATBOT_INTERN_PASSWORD === env.CHATBOT_RA_PASSWORD) {
    setupError = 'The two accounts need different passwords.';
  }
  const sessionSecret = crypto.randomBytes(32);
  const revokedSessions = new Map();
  const loginAttempts = [];
  const requestsByUser = new Map();
  const active = new Set();

  function authenticate(token) {
    if (setupError || typeof token !== 'string' || token.length > 2048) return null;
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) return null;
    const expected = crypto.createHmac('sha256', sessionSecret).update(body).digest();
    let supplied;
    try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    let claim;
    try { claim = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
    if (!Number.isFinite(claim.exp) || claim.exp <= now() || !accounts.has(claim.id) || revokedSessions.has(claim.nonce)) return null;
    return { id: claim.id, label: accounts.get(claim.id).label, exp: claim.exp, nonce: claim.nonce };
  }

  function login(accountId, password, ip) {
    if (setupError) throw failure('The private logins need to be configured before use.', 503, 'login_setup');
    const cutoff = now() - 15 * 60 * 1000;
    while (loginAttempts.length && loginAttempts[0].at < cutoff) loginAttempts.shift();
    for (const [nonce, expires] of revokedSessions) if (expires <= now()) revokedSessions.delete(nonce);
    if (loginAttempts.length >= 30 || loginAttempts.filter(a => a.ip === ip).length >= 5) {
      throw failure('Too many sign-in attempts. Please wait 15 minutes.', 429, 'login_limit');
    }
    loginAttempts.push({ at: now(), ip });
    const account = accounts.get(accountId);
    const candidate = typeof password === 'string' && password.length <= 256 ? password : '';
    // Perform the expensive comparison even for an unknown account.
    const hash = crypto.scryptSync(candidate, account ? account.salt : Buffer.alloc(16), 32);
    if (!account || !crypto.timingSafeEqual(hash, account.hash)) {
      throw failure('The account or password was not recognized.', 401, 'invalid_login');
    }
    const claim = { id: account.id, exp: now() + 8 * 60 * 60 * 1000, nonce: crypto.randomUUID() };
    const body = Buffer.from(JSON.stringify(claim)).toString('base64url');
    const signature = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
    return { token: `${body}.${signature}`, user: { id: account.id, label: account.label }, expiresAt: claim.exp };
  }

  function requireAuth(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const header = req.get('authorization') || '';
    const user = header.startsWith('Bearer ') ? authenticate(header.slice(7)) : null;
    if (!user) return res.status(setupError ? 503 : 401).json({ error: setupError ? 'Private logins have not been configured.' : 'Please sign in to use the chatbot.', code: setupError ? 'login_setup' : 'sign_in_required' });
    const recent = (requestsByUser.get(user.id) || []).filter(at => at > now() - 60000);
    if (recent.length >= 120) return res.status(429).json({ error: 'Please wait a minute before making more requests.', code: 'usage_limit' });
    recent.push(now()); requestsByUser.set(user.id, recent);
    req.auth = user;
    next();
  }

  async function begin(userId, messages) {
    if (env.RENDER && !remote && !env.CHATBOT_DATA_DIR) {
      throw failure('The free database must be connected before AI answers can be enabled.', 503, 'storage_setup');
    }
    if (active.size) throw failure('An answer is already being prepared. Please wait a moment.', 429, 'busy');
    const inputBytes = Buffer.byteLength(JSON.stringify(messages), 'utf8');
    if (inputBytes > MAX_INPUT_BYTES) throw failure('This conversation and its sources are too long for the pilot limit. Try a shorter question in a new chat.', 413, 'input_limit');
    const at = new Date(now()).toISOString();
    const day = at.slice(0, 10);
    const nextDay = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString();
    const reserve = ((inputBytes + 1024) * inputRate + MAX_OUTPUT_TOKENS * outputRate) / 1e6;
    const id = crypto.randomUUID();
    active.add(id);
    try {
      if (remote) {
        await remote.reserve({ id, startedAt: at, userId, model: MODEL, reserve, inputRate, outputRate, priceSource, dailyBudget, dailyQuestions, personQuestions });
        return id;
      }
      db.exec('BEGIN IMMEDIATE');
      try {
      const totals = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(COALESCE(estimated_usd,reserved_usd)),0) AS cost FROM usage WHERE started_at>=? AND started_at<?').get(day, nextDay);
      const person = db.prepare('SELECT COUNT(*) AS n FROM usage WHERE user_id=? AND started_at>=? AND started_at<?').get(userId, day, nextDay);
      const minute = db.prepare('SELECT COUNT(*) AS n FROM usage WHERE user_id=? AND started_at>=?').get(userId, new Date(now() - 60000).toISOString());
      if (totals.n >= dailyQuestions || person.n >= personQuestions) throw failure('The daily question allowance has been reached. Please try again tomorrow. Allowances reset at midnight UTC.');
      if (minute.n >= 5) throw failure('Please wait a minute before asking another question.');
      if (totals.cost + reserve > dailyBudget) throw failure('The daily estimated cost allowance has been reached. Please try again tomorrow.');
      db.prepare('INSERT INTO usage (id,started_at,user_id,model,status,reserved_usd,input_rate,output_rate,price_source) VALUES (?,?,?,?,?,?,?,?,?)').run(id, at, userId, MODEL, 'pending', reserve, inputRate, outputRate, priceSource);
      db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    } catch (error) { active.delete(id); throw error; }
    return id;
  }

  async function finish(id, { response, errorCode, attempted = true } = {}) {
    const usage = response && response.usage;
    const valid = usage && Number.isSafeInteger(usage.prompt_tokens) && usage.prompt_tokens >= 0 && Number.isSafeInteger(usage.completion_tokens) && usage.completion_tokens >= 0;
    const cost = valid ? (usage.prompt_tokens * inputRate + usage.completion_tokens * outputRate) / 1e6 : (attempted ? null : 0);
    const row = {
      status: errorCode ? (valid ? 'failed' : (attempted ? 'unknown_cost' : 'not_sent')) : (valid ? 'complete' : 'unknown_cost'),
      cost, inputTokens: valid ? usage.prompt_tokens : null, outputTokens: valid ? usage.completion_tokens : null,
      model: response && response.model || MODEL, errorCode: errorCode || null
    };
    try {
      if (remote) { await remote.finish(id, row); return; }
      db.prepare('UPDATE usage SET status=?, estimated_usd=?, input_tokens=?, output_tokens=?, model=?, error_code=? WHERE id=?').run(
        row.status, row.cost, row.inputTokens, row.outputTokens, row.model, row.errorCode, id
      );
    } finally { active.delete(id); }
  }

  async function rows(userId) {
    let result;
    if (remote) result = await remote.rows(userId);
    else {
      const query = userId === 'owner' ? 'SELECT * FROM usage ORDER BY started_at DESC LIMIT 5000' : 'SELECT * FROM usage WHERE user_id=? ORDER BY started_at DESC LIMIT 5000';
      result = userId === 'owner' ? db.prepare(query).all() : db.prepare(query).all(userId);
    }
    const labels = { owner: 'Chatbot Intern', supervisor: 'Chatbot RA' };
    return result.map(row => ({ ...row, account_label: labels[row.user_id] || row.user_id }));
  }

  async function csv(userId) {
    const columns = ['started_at','account_label','user_id','model','status','input_tokens','output_tokens','estimated_usd','reserved_usd','input_rate','output_rate','price_source','error_code'];
    const cell = value => {
      let text = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    return [columns.map(cell).join(','), ...(await rows(userId)).map(row => columns.map(key => cell(row[key])).join(','))].join('\r\n');
  }

  return { login, authenticate, requireAuth, begin, finish, rows, csv,
    logout: user => revokedSessions.set(user.nonce, user.exp),
    close: async () => { if (db) db.close(); if (remote) await remote.close(); },
    chatManager: remote && remote.chatManager,
    settings: { model: MODEL, dailyBudget, dailyQuestions, personQuestions, priceSource, storageConfigured: !env.RENDER || Boolean(remote || env.CHATBOT_DATA_DIR), storage: remote ? remote.kind : 'local' },
    dataDir: root };
}

module.exports = { createPilot, MODEL, MAX_OUTPUT_TOKENS, MAX_QUESTION_CHARS };
