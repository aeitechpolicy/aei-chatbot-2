import React from 'react';
import { ArrowRight, BookOpen, Columns2, FileText, Flag, Newspaper, Search } from 'lucide-react';
import ResearchDialog from './ResearchDialog';

const updates = [
  { icon: Search, title: 'Choose the next research direction', text: 'Stay in the four-scholar library, explore other AEI perspectives online, or add wider-web context. Review the question before sending.' },
  { icon: BookOpen, title: 'Follow a topic privately', text: 'Save a chat to Topic inbox. At sign in, due topics are checked once every 24 hours. Manual checks are also available. Choose a source scope before discussing an update.' },
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
    text: 'Open Article sources to preview and copy concise findings from the answer, including important qualifications and linked sources.'
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

export default function WhatsNew({ onClose, onContinue }) {
  return <ResearchDialog paged title="What’s new in the AEI Chatbot" onClose={onClose} className="onboarding-dialog whats-new-dialog"
    closeLabel="Continue to before-and-after comparison" closeText="Continue →">
    <div className="whats-new onboarding-body">
      <p className="onboarding-stages">1 of 3 · What’s new</p>
      <p>This version brings together research from Brent Orrell, Clay Calvert, Shane Tews, and Will Rinehart. Responses are generated using Meta Muse Spark Open, with relevant source passages supplied for each question.</p>
      <p>Next: a before-and-after comparison of the original chatbot and the November workspace, followed by the guided demo.</p>
      <h3 className="whats-new-feature-heading">Explore the new features</h3>
      <ul className="whats-new-list">
        {updates.map(({ icon: Icon, title, text }) => <li key={title}>
          <Icon size={19} aria-hidden="true" />
          <div><h3>{title}</h3><p>{text}</p></div>
        </li>)}
      </ul>
    </div>
    <footer className="research-dialog-actions walkthrough-actions">
      <p className="onboarding-next">Next: the original chatbot and the new workspace, in a dedicated before-and-after comparison.</p>
      <button type="button" className="research-primary" onClick={onContinue}>
        See the change <ArrowRight size={16} aria-hidden="true" />
      </button>
    </footer>
  </ResearchDialog>;
}
