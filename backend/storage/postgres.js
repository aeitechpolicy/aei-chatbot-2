const crypto = require('node:crypto');

const SCHEMA = [
  'SELECT pg_advisory_xact_lock(1470293340)',
  `CREATE TABLE IF NOT EXISTS aei_pilot_usage (
    id TEXT PRIMARY KEY, started_at TIMESTAMPTZ NOT NULL, user_id TEXT NOT NULL,
    model TEXT NOT NULL, status TEXT NOT NULL, reserved_usd DOUBLE PRECISION NOT NULL,
    estimated_usd DOUBLE PRECISION, input_tokens INTEGER, output_tokens INTEGER,
    input_rate DOUBLE PRECISION NOT NULL, output_rate DOUBLE PRECISION NOT NULL,
    price_source TEXT NOT NULL, error_code TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS aei_pilot_usage_started ON aei_pilot_usage(started_at)',
  `CREATE TABLE IF NOT EXISTS aei_pilot_chats (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, domain_name TEXT NOT NULL,
    title TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS aei_pilot_feedback (
    id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, message_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL, reporter_label TEXT NOT NULL, category TEXT NOT NULL,
    detail TEXT NOT NULL, answer TEXT NOT NULL, UNIQUE (chat_id, message_index)
  )`,
  `CREATE TABLE IF NOT EXISTS aei_pilot_source_feedback (
    id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL, reporter_label TEXT NOT NULL,
    category TEXT NOT NULL, detail TEXT NOT NULL, source JSONB NOT NULL
  )`,
  `CREATE OR REPLACE FUNCTION aei_pilot_reserve(p JSONB) RETURNS VOID
    LANGUAGE plpgsql VOLATILE AS $$
    DECLARE
      at_time TIMESTAMPTZ := (p->>'startedAt')::TIMESTAMPTZ;
      day_start TIMESTAMPTZ := date_trunc('day', at_time AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
      total_n BIGINT; person_n BIGINT; minute_n BIGINT; total_cost DOUBLE PRECISION;
    BEGIN
      PERFORM pg_advisory_xact_lock(1470293341);
      SELECT COUNT(*), COALESCE(SUM(COALESCE(estimated_usd, reserved_usd)), 0)
        INTO total_n, total_cost FROM aei_pilot_usage
        WHERE started_at >= day_start AND started_at < day_start + INTERVAL '24 hours';
      SELECT COUNT(*) INTO person_n FROM aei_pilot_usage
        WHERE user_id = p->>'userId' AND started_at >= day_start AND started_at < day_start + INTERVAL '24 hours';
      SELECT COUNT(*) INTO minute_n FROM aei_pilot_usage
        WHERE user_id = p->>'userId' AND started_at >= at_time - INTERVAL '1 minute';
      IF total_n >= (p->>'dailyQuestions')::INTEGER OR person_n >= (p->>'personQuestions')::INTEGER THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='daily_question_limit';
      END IF;
      IF minute_n >= 5 THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='minute_question_limit';
      END IF;
      IF total_cost + (p->>'reserve')::DOUBLE PRECISION > (p->>'dailyBudget')::DOUBLE PRECISION THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='daily_budget_limit';
      END IF;
      INSERT INTO aei_pilot_usage
        (id, started_at, user_id, model, status, reserved_usd, input_rate, output_rate, price_source)
      VALUES (p->>'id', at_time, p->>'userId', p->>'model', 'pending',
        (p->>'reserve')::DOUBLE PRECISION, (p->>'inputRate')::DOUBLE PRECISION,
        (p->>'outputRate')::DOUBLE PRECISION, p->>'priceSource');
    END; $$`
];

function neonDriver(connectionString) {
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('The database connection setting is invalid.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !/^ep-[a-z0-9.-]+\.neon\.tech$/i.test(url.hostname) || !url.username || !url.password || url.pathname.length < 2) {
    throw new Error('Use the private PostgreSQL connection string from the Neon project.');
  }
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(connectionString);
  const options = () => ({ fetchOptions: { signal: AbortSignal.timeout(15000) } });
  return {
    query: (text, values = []) => sql.query(text, values, options()),
    batch: statements => sql.transaction(statements.map(text => sql.query(text)), { ...options(), isolationLevel: 'ReadCommitted' })
  };
}

function normalizeRow(row) {
  if (!row) return null;
  const out = { ...row };
  for (const key of ['started_at', 'createdAt', 'updatedAt']) if (out[key]) out[key] = new Date(out[key]).toISOString();
  return out;
}

class PostgresStorage {
  constructor({ connectionString, driver, now = Date.now } = {}) {
    this.driver = driver || neonDriver(connectionString);
    this.now = now;
    this.persistent = true;
    this.kind = 'neon';
    this.ready = null;
    this.chatManager = new PostgresChats(this);
  }

  async initialize() {
    if (!this.ready) {
      this.ready = this.driver.batch(SCHEMA).catch(error => { this.ready = null; throw error; });
    }
    await this.ready;
  }

  async query(text, values = []) {
    await this.initialize();
    return this.driver.query(text, values);
  }

  async reserve(row) {
    try { await this.query('SELECT aei_pilot_reserve($1::jsonb)', [JSON.stringify(row)]); }
    catch (error) {
      const messages = {
        daily_question_limit: 'The daily question allowance has been reached. Please try again tomorrow. Allowances reset at midnight UTC.',
        minute_question_limit: 'Please wait a minute before asking another question.',
        daily_budget_limit: 'The daily estimated cost allowance has been reached. Please try again tomorrow.'
      };
      if (error.code === 'P0001' && messages[error.message]) throw Object.assign(new Error(messages[error.message]), { status: 429, code: 'usage_limit' });
      throw error;
    }
  }

  async finish(id, row) {
    await this.query(`UPDATE aei_pilot_usage SET status=$2, estimated_usd=$3,
      input_tokens=$4, output_tokens=$5, model=$6, error_code=$7 WHERE id=$1`,
    [id, row.status, row.cost, row.inputTokens, row.outputTokens, row.model, row.errorCode]);
  }

  async rows(userId) {
    const rows = userId === 'owner'
      ? await this.query('SELECT * FROM aei_pilot_usage ORDER BY started_at DESC LIMIT 5000')
      : await this.query('SELECT * FROM aei_pilot_usage WHERE user_id=$1 ORDER BY started_at DESC LIMIT 5000', [userId]);
    return rows.map(normalizeRow);
  }

  async saveFeedback(report) {
    await this.query(`INSERT INTO aei_pilot_feedback
      (id,chat_id,message_index,created_at,reporter_label,category,detail,answer)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (chat_id,message_index) DO NOTHING`,
    [report.id, report.chatId, report.messageIndex, report.createdAt, report.reporterLabel, report.category, report.detail, report.answer]);
  }

  async saveSourceFeedback(report) {
    await this.query(`INSERT INTO aei_pilot_source_feedback
      (id,created_at,reporter_label,category,detail,source)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (id) DO NOTHING`,
    [report.id, report.createdAt, report.reporterLabel, report.category, report.detail, JSON.stringify(report.source)]);
  }

  async feedbackReports() {
    const rows = await this.query(`SELECT id, created_at AS "createdAt", reporter_label AS "reporterLabel",
      category, detail, answer, NULL::jsonb AS source FROM aei_pilot_feedback
      UNION ALL
      SELECT id, created_at, reporter_label, category, detail, NULL, source FROM aei_pilot_source_feedback
      ORDER BY "createdAt" DESC, id DESC`);
    return rows.map(normalizeRow);
  }

  async close() { /* The HTTP driver has no background connection pool. */ }
}

const CHAT_COLUMNS = `id, user_id AS "userId", domain_name AS "domainName", title,
  created_at AS "createdAt", updated_at AS "updatedAt", messages`;

class PostgresChats {
  constructor(store) { this.store = store; }

  async createChat(domainName = 'General', title = null, userId = 'owner') {
    const id = crypto.randomUUID();
    const at = new Date(this.store.now()).toISOString();
    const rows = await this.store.query(`INSERT INTO aei_pilot_chats
      (id,user_id,domain_name,title,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)
      RETURNING ${CHAT_COLUMNS}`, [id, userId, domainName, title || 'New Chat', at]);
    return normalizeRow(rows[0]);
  }

  async getChat(id) {
    return normalizeRow((await this.store.query(`SELECT ${CHAT_COLUMNS} FROM aei_pilot_chats WHERE id=$1`, [id]))[0]);
  }

  async getChatWithUserCheck(id, userId) {
    return normalizeRow((await this.store.query(`SELECT ${CHAT_COLUMNS} FROM aei_pilot_chats WHERE id=$1 AND user_id=$2`, [id, userId]))[0]);
  }

  async getUserChats(userId) {
    const rows = await this.store.query(`SELECT id, user_id AS "userId", domain_name AS "domainName", title,
      created_at AS "createdAt", updated_at AS "updatedAt", jsonb_array_length(messages) AS "messageCount"
      FROM aei_pilot_chats WHERE user_id=$1 ORDER BY updated_at DESC`, [userId]);
    return rows.map(normalizeRow);
  }

  async addMessage(id, message, initialTitle = null) {
    const at = new Date(this.store.now()).toISOString();
    const stamped = { ...message, timestamp: at };
    const rows = await this.store.query(`UPDATE aei_pilot_chats SET messages=messages || $2::jsonb,
      updated_at=$3, title=CASE WHEN title='New Chat' THEN COALESCE($4::text, title) ELSE title END
      WHERE id=$1 RETURNING id`, [id, JSON.stringify([stamped]), at, initialTitle]);
    if (!rows.length) throw new Error('Chat not found');
    return stamped;
  }

  async updateChatTitle(id, title) {
    const rows = await this.store.query(`UPDATE aei_pilot_chats SET title=$2, updated_at=$3
      WHERE id=$1 RETURNING ${CHAT_COLUMNS}`, [id, title, new Date(this.store.now()).toISOString()]);
    if (!rows.length) throw new Error('Chat not found');
    return normalizeRow(rows[0]);
  }

  async deleteChat(id) {
    return (await this.store.query('DELETE FROM aei_pilot_chats WHERE id=$1 RETURNING id', [id])).length > 0;
  }
}

module.exports = { PostgresStorage, neonDriver, SCHEMA };
