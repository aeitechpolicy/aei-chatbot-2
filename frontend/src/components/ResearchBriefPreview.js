import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import ResearchDialog from './ResearchDialog';
import { copyResearchBrief } from '../utils/researchBrief';

export default function ResearchBriefPreview({ brief, onClose }) {
  const [status, setStatus] = useState('');
  const links = new Map(brief.references.map(source => [`[${source.id}]`, source.url]));
  async function copy() {
    try {
      await copyResearchBrief(brief);
      setStatus('Research brief copied.');
    } catch {
      setStatus('Clipboard access is unavailable. You can select and copy the preview.');
    }
  }

  return <ResearchDialog title="Research brief" onClose={onClose}>
    <article className="brief-preview">
      <h3>{brief.heading}</h3>
      <h4>Key findings</h4>
      <ul>{brief.findings.map((finding, index) => <li key={index}>
        {finding.split(/(\[[SW]\d+\])/g).map((part, tokenIndex) => links.get(part)
          ? <a key={tokenIndex} href={links.get(part)} target="_blank" rel="noopener noreferrer">{part}</a>
          : part)}
      </li>)}</ul>
      <h4>Sources</h4>
      <ul>{brief.references.map(({ id, label, url }) => <li key={id}>
        {url ? <a href={url} target="_blank" rel="noopener noreferrer">{label}</a> : label}
      </li>)}</ul>
    </article>
    <footer className="research-dialog-actions">
      <span role="status">{status}</span>
      <button type="button" className="research-primary" onClick={copy}><Copy size={16} /> Copy brief</button>
    </footer>
  </ResearchDialog>;
}
