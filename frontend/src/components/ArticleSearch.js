import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, apiFetch } from '../utils/api';
import SourceCards from './SourceCards';
import '../styles/Research.css';

export default function ArticleSearch({ domains = {}, selectedDomain = 'General' }) {
  const [query, setQuery] = useState('');
  const [scholar, setScholar] = useState(selectedDomain);
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
  return <main className="article-search">
    <div className="research-heading">
      <h2>Search articles</h2>
      <p>Find passages in the saved AEI archive, for one scholar or across scholars. This search uses no AI credits.</p>
    </div>
    <form className="research-search-form" onSubmit={search}>
      <label htmlFor="research-query">Topic or research question</label>
      <input id="research-query" value={query} onChange={e => setQuery(e.target.value)} maxLength={6000} placeholder="For example, AI and workforce training" required disabled={loading} />
      <div className="research-controls">
        <label htmlFor="research-scholar">Scholar
          <select id="research-scholar" value={scholar} onChange={e => { setScholar(e.target.value); setResult(null); setError(''); }} disabled={loading}>
            <option value="General">All scholars</option>
            {Object.entries(domains).map(([key, domain]) => <option key={key} value={key}>{domain.name || key.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <button type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Search saved articles'}</button>
        <button type="button" className="research-overview" disabled={loading} onClick={event => { setQuery('main themes'); search(event, 'main themes'); }}>Explore a recent sample</button>
      </div>
    </form>
    {error && <p role="alert" className="research-error">{error}</p>}
    {loading && <p role="status">Searching the saved archive…</p>}
    {result && <section aria-label="Article search results">
      <p role="status">{result.mode === 'overview' ? `Showing a recent sample of ${result.articles.length} saved articles.` : result.articles.length ? `${result.matchedCount} matching saved articles; showing ${result.articles.length}.` : 'No matching articles found. Try different topic words or another scholar.'}</p>
      {result.mode === 'overview' && <p className="research-note">This is a recent sample across the selected scholars, not a complete review of their work. Read the excerpts to explore possible themes.</p>}
      <SourceCards sources={result.articles} preview />
      <p className="research-note">Search covers {result.coverage.articles.toLocaleString()} saved articles. Coverage and dates may be incomplete; these results do not search the live web.</p>
    </section>}
  </main>;
}
