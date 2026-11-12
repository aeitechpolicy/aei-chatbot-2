import React from 'react';
import { ArrowRight, BookOpen, Columns2, FileText, Flag, Newspaper, Search } from 'lucide-react';
import ResearchDialog from './ResearchDialog';

const updates = [
  {
    icon: Search,
    title: 'Find articles and build a source list',
    text: 'See the most recent article, filter by publication date, and sort newest first. Highlighted passages show where your terms appear. Select results to copy their citations and links.'
  },
  {
    icon: BookOpen,
    title: 'See the evidence behind an answer',
    text: 'Open a numbered citation to read the passage, check the author and publication date, and follow the link to AEI.'
  },
  {
    icon: Columns2,
    title: 'Compare scholars and keep exploring',
    text: 'See perspectives side by side, use suggested follow-ups, and return to chats named for the question you asked.'
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
  return <ResearchDialog title="What’s new in the AEI Chatbot" onClose={onClose}>
    <div className="whats-new">
      <p>This version helps you find and use research from Brent Orrell, Clay Calvert, Shane Tews, and Will Rinehart.</p>
      <p>Use the version buttons to try the August archive or the November update. Each version keeps its own chat history.</p>
      <ul className="whats-new-list">
        {updates.map(({ icon: Icon, title, text }) => <li key={title}>
          <Icon size={19} aria-hidden="true" />
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </li>)}
      </ul>
    </div>
    <footer className="research-dialog-actions walkthrough-actions">
      <button type="button" className="walkthrough-dismiss" onClick={onClose}>Go to chatbot</button>
      <button type="button" className="research-primary" onClick={onStartTour}>
        Start guided demo <ArrowRight size={16} aria-hidden="true" />
      </button>
    </footer>
  </ResearchDialog>;
}
