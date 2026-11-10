import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../utils/api';
import { SCHOLARS, SCHOLAR_NAMES } from '../utils/scholars';
import SourceCards from './SourceCards';
import '../styles/Research.css';

export default function ArticleSearch({ showFileCounts = true }) {
  const [query, setQuery] = useState('');
  const [scholar, setScholar] = useState('General');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  useEffect(() => () => { ++requestVersion.current; }, []);
  async function search(event, searchQuery = query) {
    event.preventDefault();
    if (!searchQuery.trim() || loading) return;
    const version = ++requestVersion.current;
    setLoading(true); setError(''); setResult(null);
    try {
      const params = new URLSearchParams({ q: searchQuery.trim(), scholar });
      const response = await apiFetch(`${API_BASE_URL}/api/research/search?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The article search could not be completed.');
      if (version === requestVersion.current) setResult(data);
    } catch (failure) {
      if (version === requestVersion.current) setError(failure.message || 'The article archive could not be reached.');
    } finally { if (version === requestVersion.current) setLoading(false); }
  }
  return <main className={`article-search ${!result && !loading ? 'workspace-start' : ''}`}>
    <div className="workspace-intro">
      <p className="workspace-kicker">Scholar Article Finder</p>
      <h2>Find an article or passage.</h2>
      <p>Search by topic, title, or scholar.</p>
      <p className="workspace-scholars">{SCHOLAR_NAMES}</p>
    </div>
    <form className="research-search-form" onSubmit={search}>
      <div className="workspace-composer">
        <input id="research-query" aria-label="Topic or research question" value={query} onChange={e => setQuery(e.target.value)} maxLength={6000} placeholder="Try spectrum sharing or age verification" required disabled={loading} />
        <button type="submit" className="send-button" aria-label="Search saved articles" title="Search saved articles" disabled={loading || !query.trim()}><Search size={18} /></button>
      </div>
      <div className="research-controls">
        <label htmlFor="research-scholar">Scholar
          <select id="research-scholar" value={scholar} onChange={e => { setScholar(e.target.value); setResult(null); setError(''); }} disabled={loading}>
            <option value="General">All 4 scholars</option>
            {Object.entries(SCHOLARS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
        </label>
        <button type="button" className="research-overview" disabled={loading} onClick={event => { setQuery('main themes'); search(event, 'main themes'); }}>Explore a recent sample</button>
      </div>
    </form>
    {error && <p role="alert" className="research-error">{error}</p>}
    {loading && <p role="status">Searching the saved archive…</p>}
    {result && <section aria-label="Article search results">
      <p role="status">{result.mode === 'overview' ? `Showing a recent sample of ${result.articles.length} saved articles.` : result.articles.length ? `${result.matchedCount} matching saved articles; showing ${result.articles.length}.` : 'No matching articles found. Try different topic words or another scholar.'}</p>
      {result.mode === 'overview' && <p className="research-note">This is a recent sample across the selected scholars, not a complete review of their work. Read the excerpts to explore possible themes.</p>}
      <SourceCards sources={result.articles} preview />
      {(showFileCounts || result.coverage.latestPublishedDate) && <p className="research-note">
        {showFileCounts && `Search covers ${result.coverage.articles.toLocaleString()} saved articles in this selection. `}
        {result.coverage.latestPublishedDate && `Newest recorded publication date: ${result.coverage.latestPublishedDate}.`}
      </p>}
    </section>}
  </main>;
}
