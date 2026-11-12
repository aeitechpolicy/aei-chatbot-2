import React, { useState } from 'react';
import { ArrowUpRight, Flag } from 'lucide-react';
import { sourceLink } from '../utils/sources';
import FeedbackDialog from './FeedbackDialog';
import '../styles/Research.css';

function highlightedText(text = '', ranges = []) {
  let position = 0;
  const parts = [];
  for (const [start, end] of ranges) {
    if (start < position || end > text.length || end <= start) continue;
    parts.push(text.slice(position, start), <mark key={start}>{text.slice(start, end)}</mark>);
    position = end;
  }
  return [...parts, text.slice(position)];
}

function SourceReportButton({ source, chatFeedback }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const label = sent ? 'Sent to the team' : 'Send to the team';
  return <>
    <button className="research-secondary source-report-button" type="button" aria-label={`${label}: ${source.title}`} disabled={sent}
      onClick={() => setOpen(true)}><Flag size={14} aria-hidden="true" /> {label}</button>
    {open && <FeedbackDialog {...chatFeedback} source={source} sent={sent} onSent={() => setSent(true)} onClose={() => setOpen(false)} />}
  </>;
}

export default function SourceCards({ sources = [], preview = false, selection = [], onToggleSource, chatFeedback }) {
  return <ol className="research-sources">
    {sources.map((source, index) => {
      if (typeof source === 'string') return <li key={index} className="research-source legacy-source">{source}</li>;
      const url = sourceLink(source);
      const excerpt = source.excerpt || source.body || '';
      const shortened = preview && excerpt.length > 650;
      const visibleExcerpt = shortened ? excerpt.slice(0, 650).replace(/\s+\S*$/, '') + ' …' : excerpt;
      const fullExcerpt = shortened ? excerpt : preview && source.body !== excerpt ? source.body : null;
      const author = [source.author, source.publisher, source.authors?.join(', ')]
        .find(name => name && name !== 'Author not recorded');
      const collectionNames = source.collections?.join(', ');
      const event = source.sourceType === 'event';
      const byline = event ? 'AEI event' : author || (collectionNames ? `${collectionNames} (scholar collection)` : 'Author not recorded');
      const date = event ? source.eventDate : source.date;
      const title = highlightedText(source.title, source.titleMatches);
      const canReport = source.sourceRef || (chatFeedback && /^[SW]\d{1,2}$/.test(source.id));
      return <li key={index} className="research-source">
        <h3><span className="source-number">[{source.id || `S${index + 1}`}]</span> {url
          ? <a href={url} target="_blank" rel="noopener noreferrer">
            {title}
            {preview && <span className="article-result-action" aria-hidden="true">Open on AEI <ArrowUpRight size={14} /></span>}
          </a>
          : <span>{title}</span>}</h3>
        <p className="source-metadata">{byline}{date ? ` · ${date}` : ' · Date not recorded'}</p>
        {excerpt && <blockquote>{highlightedText(visibleExcerpt, source.passageMatches)}</blockquote>}
        {fullExcerpt && <details className="source-excerpt"><summary>Read full excerpt</summary><blockquote>{fullExcerpt}</blockquote></details>}
        <p className="source-coverage">{source.kind === 'web' ? 'Web search snippet' : event ? 'Event information' : source.fullText === false ? 'Catalog excerpt only' : 'Excerpt from AEI Scholar Library'}{!url ? ' · Original link not recorded' : ''}</p>
        {(onToggleSource || canReport) && <div className="source-card-actions">
          {onToggleSource && <label className="source-selection">
            <input type="checkbox" checked={selection.includes(source.id)} aria-label={`Select ${source.title} for source list`} onChange={() => onToggleSource(source.id)} />
            Add to source list
          </label>}
          {canReport && <SourceReportButton key={`${chatFeedback?.chatId || 'search'}:${source.sourceRef || source.id}`} source={source} chatFeedback={chatFeedback} />}
        </div>}
      </li>;
    })}
  </ol>;
}
