import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { safeSourceUrl } from '../utils/sources';
import '../styles/Research.css';

export default function SourceCards({ sources = [], preview = false }) {
  return <ol className="research-sources">
    {sources.map((source, index) => {
      if (typeof source === 'string') return <li key={index} className="research-source legacy-source">{source}</li>;
      const url = safeSourceUrl(source.url);
      const excerpt = source.excerpt || source.body || '';
      const shortened = preview && excerpt.length > 650;
      const visibleExcerpt = shortened ? excerpt.slice(0, 650).replace(/\s+\S*$/, '') + ' …' : excerpt;
      const author = source.author || source.authors?.join(', ') || 'Author not recorded';
      return <li key={index} className="research-source">
        <h3><span className="source-number">[{source.id || `S${index + 1}`}]</span> {url
          ? <a href={url} target="_blank" rel="noopener noreferrer">
            {source.title}
            {preview && <span className="article-result-action" aria-hidden="true">Open on AEI <ArrowUpRight size={14} /></span>}
          </a>
          : <span>{source.title}</span>}</h3>
        <p className="source-metadata">{author}{source.date ? ` · ${source.date}` : ' · Date not recorded'}</p>
        {source.collections?.length > 0 && <p className="source-metadata">Saved under: {source.collections.join(', ')}</p>}
        {excerpt && <blockquote>{visibleExcerpt}</blockquote>}
        {shortened && <details className="source-excerpt"><summary>Read full saved excerpt</summary><blockquote>{excerpt}</blockquote></details>}
        <p className="source-coverage">{source.fullText === false ? 'Catalog excerpt only' : 'Excerpt from saved article'}{!url ? ' · Original link not recorded' : ''}</p>
      </li>;
    })}
  </ol>;
}
