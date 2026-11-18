import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, chatEndpoint, signOut } from '../utils/api';
import ArticleSearch from './ArticleSearch';
import MessageList from './MessageList';
import UsageReport from './UsageReport';
import '../styles/ModelTester.css';

const scholars = ['All 4 scholars', 'Brent Orrell', 'Clay Calvert', 'Shane Tews', 'Will Rinehart'];
const cost = value => value === null || value === undefined ? 'Cost uncertain' : `$${Number(value).toFixed(5)} estimated`;

export default function ModelTester({ session }) {
  const [view, setView] = useState('archive');
  const [config, setConfig] = useState(null);
  const [modelIds, setModelIds] = useState([]);
  const [scope, setScope] = useState('General');
  const [compareScholars, setCompareScholars] = useState(false);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [chat, setChat] = useState(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const historyRequest = useRef(0);

  async function read(url, options) {
    const response = await apiFetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The comparison could not be loaded.');
    return data;
  }
  async function refreshHistory() { setHistory(await read(chatEndpoint('history'))); }

  useEffect(() => {
    let cancelled = false;
    Promise.all([read(chatEndpoint('capabilities')), read(chatEndpoint('history'))]).then(([data, chats]) => {
      if (cancelled) return;
      setConfig(data);
      setModelIds((data.models || []).map(model => model.id));
      setHistory(chats);
    }).catch(problem => { if (!cancelled) setError(problem.message); });
    return () => { cancelled = true; };
  }, []);

  async function selectChat(id) {
    const request = ++historyRequest.current;
    setError('');
    if (!id) { setChat(null); setOpening(false); setQuestion(''); return; }
    setOpening(true);
    try {
      const saved = await read(chatEndpoint(id));
      if (request === historyRequest.current) { setChat(saved); setScope(saved.domainName); setQuestion(''); }
    } catch (problem) { if (request === historyRequest.current) setError(problem.message); }
    finally { if (request === historyRequest.current) setOpening(false); }
  }

  async function send(event) {
    event.preventDefault();
    if (busy || opening || !question.trim() || !modelIds.length) return;
    setBusy(true); setError('');
    const message = question.trim();
    try {
      let current = chat;
      if (!current) {
        current = await read(chatEndpoint('new'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domainName: scope }) });
        setChat(current);
      }
      const data = await read(chatEndpoint(`${current.id}/message`), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mode: view === 'archive' && compareScholars ? 'compare' : view, modelIds }) });
      setChat(data.chat); setQuestion('');
      // A history refresh failure must not make a paid answer appear to have failed.
      try { await refreshHistory(); } catch { /* The loaded comparison remains visible. */ }
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  const chatMode = view === 'archive' || view === 'web';
  return <div className="app article-workspace model-testing-workspace">
    <header className="app-header"><div className="header-content">
      <div className="workspace-brand"><img src="/aeilogo.jpg" alt="AEI" className="logo" /><h1>AEI Chatbot</h1></div>
      <nav className="article-mode-switch" aria-label="Article mode">
        <button type="button" disabled={busy} aria-pressed={view === 'archive'} onClick={() => setView('archive')}>Article Chat</button>
        <button type="button" disabled={busy} aria-pressed={view === 'research'} onClick={() => setView('research')}>AEI Article Search</button>
        <button type="button" disabled={busy} aria-pressed={view === 'web'} onClick={() => setView('web')}>AEI + Web</button>
      </nav>
      <div className="pilot-header-actions"><span>{session.user.label}</span>
        <button type="button" disabled={busy} onClick={() => setView('usage')}>Usage and costs</button>
        <button type="button" onClick={() => { signOut().catch(() => {}); }}>Sign out</button>
      </div>
    </div></header>
    <main className="model-test-main">
      {error && <p role="alert" className="pilot-error">{error}</p>}
      {chatMode && <>
        <div className="model-test-heading"><div><p className="eyebrow">PRIVATE MODEL TESTING</p>
          <h2>One question. Three perspectives.</h2>
          <p>Compare answers using the same question and the same source passages. {view === 'web' ? 'Scholar passages and web results are shared across the models.' : 'Answers use the AEI Scholar Library.'}</p>
        </div><button type="button" className="research-secondary" disabled={busy || opening} onClick={() => selectChat('')}>New comparison</button></div>
        <p className="model-test-scope">Brent Orrell · Clay Calvert · Shane Tews · Will Rinehart</p>
        {!config && !error && <p role="status">Loading comparison models…</p>}
        {config && <fieldset className="model-test-choices" disabled={busy || opening}><legend>Models to compare</legend>
          {(config.models || []).map(model => <label className="model-test-choice" key={model.id}>
            <input type="checkbox" checked={modelIds.includes(model.id)} onChange={event => setModelIds(ids => event.target.checked ? [...ids, model.id] : ids.filter(id => id !== model.id))} />
            <span><strong>{model.label}</strong><small>${model.inputRate.toFixed(2)} input / ${model.outputRate.toFixed(2)} output per million tokens</small></span>
          </label>)}
        </fieldset>}
        <p className="model-test-note">Each selected model uses credits and counts as one request toward the pilot allowances. Estimates use uncached prices. Reasoning models use low effort and share the {config?.maxOutputTokens || 1024}-token output limit. No automatic retries.</p>
        <div className="model-test-tools">
          <label>Comparison history<select aria-label="Comparison history" value={chat?.id || ''} disabled={busy || opening} onChange={event => selectChat(event.target.value)}>
            <option value="">New comparison</option>{history.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select></label>
          <label>Scholars<select aria-label="Scholars" value={scope} disabled={busy || opening || Boolean(chat)} onChange={event => { setScope(event.target.value); setCompareScholars(false); }}>
            {scholars.map((name, index) => <option key={name} value={index ? name.replace(/ /g, '_') : 'General'}>{name}</option>)}
          </select></label>
          {view === 'archive' && scope === 'General' && <label className="model-test-scholar-compare"><input type="checkbox" checked={compareScholars} disabled={busy || opening} onChange={event => setCompareScholars(event.target.checked)} /> Compare the scholars’ approaches</label>}
        </div>
        {opening ? <p role="status">Opening comparison…</p> : <div className="model-test-history">
          {(chat?.messages || []).map((message, index) => message.role === 'user'
            ? <p className="model-test-question" key={index}><strong>You</strong>{message.content}</p>
            : message.modelResponses ? <div className="model-test-results" key={index} aria-label="Model responses">
              {message.modelResponses.map(result => <section className="model-test-result" key={result.model} aria-label={result.label}>
                <div className="model-test-result-heading"><h3>{result.label}</h3><span>{(result.elapsedMs / 1000).toFixed(1)} seconds</span></div>
                <p className="model-test-result-cost">{cost(result.estimatedUsd)}{result.usage ? ` · ${result.usage.prompt_tokens ?? '?'} input / ${result.usage.completion_tokens ?? '?'} output tokens` : ''}</p>
                {result.usageRecorded === false && <p className="pilot-error">Usage could not be fully recorded. Check the report before retrying.</p>}
                {result.truncated && <p className="model-test-check needs-review">The output limit was reached. This answer may be incomplete.</p>}
                {result.status === 'failed' ? <p role="alert" className="pilot-error">{result.error}</p>
                  : <><p className={`model-test-check ${result.citationNotice ? 'needs-review' : ''}`}>{result.citationNotice ? 'Needs citation review. This is the model’s original answer.' : 'Answer processed. Check the cited passages before relying on it.'}</p>
                    <MessageList messages={[{ ...result, sources: message.sources, searchMode: message.searchMode }]} title={chat.title} />
                  </>}
              </section>)}
            </div> : <MessageList key={index} messages={[message]} title={chat.title} />)}
        </div>}
        <form className="model-test-form" onSubmit={send}>
          <label htmlFor="model-test-question">Question for the selected models</label>
          <textarea id="model-test-question" value={question} maxLength={6000} rows={3} disabled={busy || opening} onChange={event => setQuestion(event.target.value)} placeholder="What has Shane Tews written about spectrum allocation and sharing?" />
          {view === 'web' && <p className="model-test-note">Experimental: the question is also sent to web search. Web results are fetched once and shared by all selected models.</p>}
          {view === 'web' && config && !config.webSearch && <p role="alert">Web search is not connected yet. Article Chat and AEI Article Search are available.</p>}
          <button className="pilot-primary" type="submit" disabled={busy || opening || !config || !question.trim() || !modelIds.length || (view === 'web' && !config.webSearch)}>
            {busy ? `Running ${modelIds.length} model${modelIds.length === 1 ? '' : 's'}…` : `Compare ${modelIds.length} model${modelIds.length === 1 ? '' : 's'}`}
          </button>
          {busy && <p role="status">Preparing the shared sources and collecting the selected models’ answers…</p>}
        </form>
      </>}
      <div hidden={view !== 'research'}><ArticleSearch active={view === 'research'} showFileCounts={false} showRefreshDetails={false} /></div>
      {view === 'usage' && <UsageReport />}
    </main>
  </div>;
}
