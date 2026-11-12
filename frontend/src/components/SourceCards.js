import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { sourceLink } from '../utils/sources';
import '../styles/Research.css';

export default function SourceCards({ sources = [], preview = false }) {
  return <ol className="research-sources">
    {sources.map((source, index) => {
      if (typeof source === 'string') return <li key={index} className="research-source legacy-source">{source}</li>;
      const url = sourceLink(source);
      const excerpt = source.excerpt || source.body || '';
      const shortened = preview && excerpt.length > 650;
      const visibleExcerpt = shortened ? excerpt.slice(0, 650).replace(/\s+\S*$/, '') + ' …' : excerpt;
      const author = [source.author, source.publisher, source.authors?.join(', ')]
        .find(name => name && name !== 'Author not recorded');
      const collectionNames = source.collections?.join(', ');
      const event = source.sourceType === 'event';
      const byline = event ? 'AEI event' : author || (collectionNames ? `${collectionNames} (scholar collection)` : 'Author not recorded');
      const date = event ? source.eventDate : source.date;
      return <li key={index} className="research-source">
        <h3><span className="source-number">[{source.id || `S${index + 1}`}]</span> {url
          ? <a href={url} target="_blank" rel="noopener noreferrer">
            {source.title}
            {preview && <span className="article-result-action" aria-hidden="true">Open on AEI <ArrowUpRight size={14} /></span>}
          </a>
          : <span>{source.title}</span>}</h3>
        <p className="source-metadata">{byline}{date ? ` · ${date}` : ' · Date not recorded'}</p>
        {excerpt && <blockquote>{visibleExcerpt}</blockquote>}
        {shortened && <details className="source-excerpt"><summary>Read full excerpt</summary><blockquote>{excerpt}</blockquote></details>}
        <p className="source-coverage">{source.kind === 'web' ? 'Web search snippet' : event ? 'Event information' : source.fullText === false ? 'Catalog excerpt only' : 'Excerpt from AEI Scholar Library'}{!url ? ' · Original link not recorded' : ''}</p>
      </li>;
    })}
  </ol>;
}
