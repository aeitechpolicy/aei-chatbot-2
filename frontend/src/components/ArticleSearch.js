import React, { useEffect, useRef, useState } from 'react';
import { Copy, Search } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../utils/api';
import { SCHOLARS, SCHOLAR_NAMES } from '../utils/scholars';
import { sourceLink } from '../utils/sources';
import SourceCards from './SourceCards';
import '../styles/Research.css';

const formatDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

const libraryDate = value => value ? <time dateTime={value}>{formatDate.format(new Date(value))}</time> : 'Not yet recorded';

function LibraryDates({ status, showRefreshDetails }) {
  if (!showRefreshDetails) {
    const article = status?.latestArticle;
    const url = sourceLink(article);
    return <p className="library-dates"><strong>Most recent article</strong>{' · '}{article ? <>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer">{article.title}</a> : article.title}{' · '}{libraryDate(article.date)}
    </> : status === undefined ? 'Checking…' : status === null ? 'Temporarily unavailable' : 'No publication date recorded'}</p>;
  }
  if (status === undefined) return <p className="library-dates" role="status">Checking library dates…</p>;
  if (status === null) return <p className="library-dates">Library update dates are temporarily unavailable.</p>;
  const { lastSuccessfulRefresh, latestPublishedDate, lastSuccessfulScrape, lastScrapeCheck, skippedInLastScrape, lastManualImport } = status;
  const stale = lastSuccessfulScrape && Date.now() - Date.parse(lastSuccessfulScrape) > 16 * 24 * 60 * 60 * 1000;
  return <div className="library-dates">
    <p>{lastSuccessfulRefresh ? <><strong>Library refreshed on</strong> {libraryDate(lastSuccessfulRefresh)}</> : 'Library refresh date not yet recorded.'}</p>
    <details className="library-refresh-details">
      <summary>Refresh details</summary>
      <p>Newest recorded publication · {libraryDate(latestPublishedDate)}</p>
      {lastManualImport && <p>Last staff import · {libraryDate(lastManualImport)}</p>}
      <p>Last successful automated scrape · {libraryDate(lastSuccessfulScrape)}.{stale && ' The scheduled refresh may be overdue.'}</p>
      {lastScrapeCheck && skippedInLastScrape > 0 && <p>The {libraryDate(lastScrapeCheck)} scrape could not fetch {skippedInLastScrape} {skippedInLastScrape === 1 ? 'article' : 'articles'}.</p>}
    </details>
  </div>;
}

function sourceList(sources) {
  return sources.map((source, index) => {
    const event = source.sourceType === 'event';
    const byline = event ? 'AEI event' : source.authors?.length ? source.authors.join(', ') : source.author || 'Author not recorded';
    return [`${index + 1}. ${source.title}`, `${byline} · ${(event ? source.eventDate : source.date) || 'Date not recorded'}`, sourceLink(source) || 'AEI link not recorded'].join('\n');
  }).join('\n\n');
}

export default function ArticleSearch({ showFileCounts = true, showRefreshDetails = true, active = true }) {
  const [query, setQuery] = useState('');
  const [scholar, setScholar] = useState('General');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('relevance');
  const [libraryStatus, setLibraryStatus] = useState(undefined);
  const [result, setResult] = useState(null);
  const [selection, setSelection] = useState([]);
  const [copyStatus, setCopyStatus] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  useEffect(() => () => { ++requestVersion.current; }, []);
  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    apiFetch(`${API_BASE_URL}/api/research/status`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setLibraryStatus(data); })
      .catch(() => { if (!controller.signal.aborted) setLibraryStatus(null); });
    return () => controller.abort();
  }, [active]);

  const rangeError = from && to && from > to;
  const selectedSources = result?.articles.filter(source => selection.includes(source.id)) || [];

  async function copySources() {
    try {
      await navigator.clipboard.writeText(sourceList(selectedSources));
      setManualCopy(false);
      setCopyStatus(`${selectedSources.length} ${selectedSources.length === 1 ? 'source' : 'sources'} copied.`);
    } catch {
      setManualCopy(true);
      setCopyStatus('Select and copy the source list below.');
    }
  }

  function toggleSource(id) {
    setSelection(selected => selected.includes(id) ? selected.filter(source => source !== id) : [...selected, id]);
    setCopyStatus('');
    setManualCopy(false);
  }

  async function search(event, searchQuery = query) {
    event.preventDefault();
    if (!searchQuery.trim() || loading || rangeError) return;
    const version = ++requestVersion.current;
    setLoading(true); setError(''); setResult(null);
    setSelection([]); setCopyStatus(''); setManualCopy(false);
    try {
      const params = new URLSearchParams({ q: searchQuery.trim(), scholar, sort });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await apiFetch(`${API_BASE_URL}/api/research/search?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The article search could not be completed.');
      if (version === requestVersion.current) setResult(data);
    } catch (failure) {
      if (version === requestVersion.current) setError(failure.message || 'The AEI Scholar Library could not be reached.');
    } finally { if (version === requestVersion.current) setLoading(false); }
  }
  return <main className={`article-search ${!result && !loading ? 'workspace-start' : ''}`}>
    <div className="workspace-intro">
      <p className="workspace-kicker">AEI Scholar Library</p>
      <h2>Search AEI articles</h2>
      <p>Find articles and passages by topic, title, or scholar.</p>
      <p className="workspace-scholars">{SCHOLAR_NAMES}</p>
    </div>
    <LibraryDates status={libraryStatus} showRefreshDetails={showRefreshDetails} />
    <form className="research-search-form" onSubmit={search}>
      <div className="workspace-composer">
        <input id="research-query" aria-label="Topic or research question" value={query} onChange={e => setQuery(e.target.value)} maxLength={6000} placeholder="Try spectrum sharing or age verification" required disabled={loading} />
        <button type="submit" className="send-button" aria-label="Search saved articles" title="Search saved articles" disabled={loading || !query.trim() || rangeError}><Search size={18} /></button>
      </div>
      <div className="research-controls">
        <label htmlFor="research-scholar">Scholar
          <select id="research-scholar" value={scholar} onChange={e => setScholar(e.target.value)} disabled={loading}>
            <option value="General">All 4 scholars</option>
            {Object.entries(SCHOLARS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
        </label>
        <label>Sort by
          <select value={sort} onChange={e => setSort(e.target.value)} disabled={loading}>
            <option value="relevance">Relevance</option><option value="newest">Newest first</option>
          </select>
        </label>
        <button type="button" className="research-overview" disabled={loading || rangeError} onClick={event => { setQuery('main themes'); search(event, 'main themes'); }}>Explore a recent sample</button>
      </div>
      <fieldset className="research-controls research-date-range">
        <legend>Publication date</legend>
        <label>From <input type="date" value={from} onInput={e => setFrom(e.currentTarget.value)} disabled={loading} /></label>
        <label>To <input type="date" value={to} onInput={e => setTo(e.currentTarget.value)} disabled={loading} /></label>
        {(from || to) && <button type="button" className="research-overview" disabled={loading} onClick={() => { setFrom(''); setTo(''); }}>Clear dates</button>}
      </fieldset>
      {rangeError && <p role="alert" className="research-error">The start date must be on or before the end date.</p>}
    </form>
    {error && <p role="alert" className="research-error">{error}</p>}
    {loading && <p role="status">Searching the AEI Scholar Library…</p>}
    {result && <section aria-label="Article search results">
      <p role="status">{!result.articles.length ? 'No matching articles found. Try other search terms or filters.' : result.mode === 'overview' ? `Showing a recent sample of ${result.articles.length} saved articles.` : `${result.matchedCount} matching saved articles. Showing ${result.articles.length}.`}</p>
      {result.mode === 'overview' && <p className="research-note">This is a recent sample across the selected scholars, not a complete review of their work. Read the excerpts to explore possible themes.</p>}
      {result.articles.length > 0 && <div className="source-copy-toolbar">
        <span>{selection.length ? `${selection.length} selected` : 'Select articles to build a source list.'}</span>
        <button type="button" className="research-secondary" disabled={!selection.length} onClick={copySources}><Copy size={16} aria-hidden="true" /> Copy source list</button>
        <span role="status">{copyStatus}</span>
        {manualCopy && <textarea aria-label="Selected sources" rows={4} readOnly value={sourceList(selectedSources)} onFocus={event => event.currentTarget.select()} />}
      </div>}
      <SourceCards sources={result.articles} preview selection={selection} onToggleSource={toggleSource} />
      {showFileCounts && <p className="research-note">Search covers {result.coverage.articles.toLocaleString()} saved articles in this selection.</p>}
    </section>}
  </main>;
}
