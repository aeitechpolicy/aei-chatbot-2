import React, { useRef } from 'react';
import { ArrowRight, BookOpen, Columns2, FileText, Flag, Newspaper, Search } from 'lucide-react';
import ResearchDialog from './ResearchDialog';
import BeforeAfterPreview from './BeforeAfterPreview';

const updates = [
  {
    icon: Search,
    title: 'Find articles and build a source list',
    text: 'See the most recent article, filter by publication date, and sort newest first. Highlighted passages show where search terms appear. Select results to copy article citations and links.'
  },
  {
    icon: BookOpen,
    title: 'See the evidence behind an answer',
    text: 'Open a numbered citation to read the passage, check the author and publication date, and follow the link to AEI.'
  },
  {
    icon: Columns2,
    title: 'Choose scholars to compare',
    text: 'Open the Compare Scholars tab, select two to four scholars, and ask one question. See perspectives side by side, with sources and clear limits where evidence is missing.'
  },
  {
    icon: FileText,
    title: 'Turn an answer into a brief',
    text: 'Open Article sources to preview and copy a research brief with linked citations.'
  },
  {
    icon: Newspaper,
    title: 'Connect the research to today’s news',
    text: 'The home page checks for policy developments hourly and recommends related reading by the scholars.'
  },
  {
    icon: Flag,
    title: 'Send a correction to the team',
    text: 'Report a specific article result, web source, or chatbot answer and explain what needs correcting.'
  }
];

export default function WhatsNew({ onClose, onStartTour }) {
  const comparison = useRef(null);
  function showComparison() {
    comparison.current?.focus({ preventScroll: true });
    comparison.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  return <ResearchDialog title="What’s new in the AEI Chatbot" onClose={onClose} className="whats-new-dialog"
    closeLabel="Continue to guided demo" closeText="Continue to demo →">
    <div className="whats-new">
      <p className="whats-new-stages">Welcome overview <ArrowRight size={14} aria-hidden="true" /> Guided demo</p>
      <p>This version brings together research from Brent Orrell, Clay Calvert, Shane Tews, and Will Rinehart.</p>
      <p>Compare Version 1.0 (pre-September 2026) with Version 2.0 (November 2026). Chats are saved separately under each account for future reference.</p>
      <button type="button" className="whats-new-comparison-shortcut" onClick={showComparison} aria-label="See the before-and-after">
        <span><strong>See the before-and-after</strong><small>Original chatbot → November 2026 workspace</small></span>
        <span className="whats-new-mini-screens" aria-hidden="true"><img src="/tour-version1.png" alt="" /><ArrowRight size={16} /><img src="/tour-version2.png" alt="" /></span>
      </button>
      <h3 className="whats-new-feature-heading">Explore the new features</h3>
      <ul className="whats-new-list">
        {updates.map(({ icon: Icon, title, text }) => <li key={title}>
          <Icon size={19} aria-hidden="true" />
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </li>)}
      </ul>
      <div ref={comparison} tabIndex={-1} role="region" aria-label="Before-and-after details" className="whats-new-comparison-target"><BeforeAfterPreview /></div>
    </div>
    <footer className="research-dialog-actions walkthrough-actions">
      <p className="whats-new-next">Next: a guided, seven-step demo. Each step can be skipped or demonstrated.</p>
      <button type="button" className="research-primary" onClick={onStartTour}>
        Start guided demo <ArrowRight size={16} aria-hidden="true" />
      </button>
    </footer>
  </ResearchDialog>;
}
