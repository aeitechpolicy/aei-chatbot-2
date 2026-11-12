import React, { useEffect, useId, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../utils/api';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const HOUR_MS = 60 * 60 * 1000;

export default function RelatedNews() {
  const headingId = useId();
  const [stories, setStories] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function refresh() {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/research/related-news`, { signal: controller.signal });
        if (!response.ok) throw new Error('Related news is unavailable.');
        const data = await response.json();
        if (controller.signal.aborted) return;
        setStories(data.stories);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(refresh, HOUR_MS);
      }
    }
    refresh();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return <section className="related-news" aria-labelledby={headingId}>
    <div className="related-news-heading">
      <h2 id={headingId}>In related news</h2>
      <p>Policy developments and related reading from our scholars.</p>
    </div>
    {failed && !stories?.length && <p className="related-news-status" role="status">Related news is temporarily unavailable.</p>}
    {!failed && !stories && <p className="related-news-status" role="status">Checking for recent developments…</p>}
    {!failed && stories?.length === 0 && <p className="related-news-status">No recent updates to show.</p>}
    {stories?.length > 0 && <div className="related-news-grid">
      {stories.map(story => <article className="related-news-card" key={story.id}>
        <p className="related-news-topic">{story.topic}</p>
        <h3>{story.title}</h3>
        <p className="related-news-development">{story.development}</p>
        <p className="related-news-source">
          <time dateTime={story.date}>{dateFormat.format(new Date(`${story.date}T00:00:00Z`))}</time>
          <span aria-hidden="true">·</span>
          <a href={story.url} target="_blank" rel="noopener noreferrer">{story.publisher} <ArrowUpRight size={13} aria-hidden="true" /></a>
        </p>
        <div className="related-news-reading">
          <h4>Related reading</h4>
          <ul>
            {story.reading.map(article => <li key={article.url}>
              <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title} <ArrowUpRight size={13} aria-hidden="true" /></a>
              <span>{article.author}</span>
            </li>)}
          </ul>
        </div>
      </article>)}
    </div>}
  </section>;
}
