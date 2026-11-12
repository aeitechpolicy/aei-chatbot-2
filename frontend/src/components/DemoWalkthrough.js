import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Flag, Globe, MessageCircle, Search } from 'lucide-react';
import ResearchDialog from './ResearchDialog';

const sampleQuestion = 'What tradeoffs do the scholars discuss around online age verification?';
const steps = ['Choose a research mode', 'Find and copy articles', 'Ask your first question', 'Check the sources', 'Help improve an answer'];
const modes = [
  {
    label: 'Article Chat',
    icon: MessageCircle,
    description: 'Ask about the four scholars’ work in the AEI Scholar Library. The chatbot uses the library to write a cited answer.'
  },
  {
    label: 'AEI Article Search',
    icon: Search,
    description: 'Find articles in the library by topic or scholar, then open the originals on AEI’s website.'
  },
  {
    label: 'AEI + Web',
    icon: Globe,
    description: 'Use this experimental mode for questions that need context beyond the library. The answer distinguishes AEI articles from web sources.'
  }
];

export default function DemoWalkthrough({ onClose, onTryQuestion, onOpenSearch, busy }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(0);
  const heading = useRef(null);
  const lastStep = step === steps.length - 1;

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  return <ResearchDialog title="How to use AEI Chatbot" onClose={onClose}>
    <div className="walkthrough">
      <div className="walkthrough-progress">
        <span>Step {step + 1} of {steps.length}</span>
        <progress value={step + 1} max={steps.length} aria-label="Walkthrough progress" />
      </div>
      <h3 ref={heading} tabIndex={-1}>{steps[step]}</h3>
      {step === 0 && <>
        <p>Select a mode to see what it does.</p>
        <div className="walkthrough-modes" role="group" aria-label="Explore research modes">
          {modes.map(({ label, icon: Icon }, index) => <button key={label} className="research-secondary"
            type="button" aria-pressed={mode === index} onClick={() => setMode(index)}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>)}
        </div>
        <p className="walkthrough-example" aria-live="polite">{modes[mode].description}</p>
      </>}
      {step === 1 && <>
        <p>Open <strong>AEI Article Search</strong>. Look for <strong>Most recent article</strong> to see the newest dated publication in the library and open it on AEI when a link is available.</p>
        <p>Enter a topic or phrase, choose a scholar or publication date range, and select <strong>Newest first</strong> to see recent matches at the top. Run the search to apply the filters.</p>
        <p>Look for highlighted words in the title or passage. Tick <strong>Add to source list</strong> on each result you want, then choose <strong>Copy source list</strong> to paste the titles, bylines, dates, and AEI links into a memo.</p>
        <p>If an article result needs a correction, use <strong>Send to the team</strong> on that result.</p>
        <button type="button" className="research-secondary" onClick={onOpenSearch}>Open AEI Article Search</button>
      </>}
      {step === 2 && <>
        <p>In <strong>Article Chat</strong>, search across all four scholars or pick one before sending your first question. Turn on <strong>Compare scholars</strong> to see their perspectives side by side where the library has evidence.</p>
        <div className="walkthrough-example">
          <strong>Example question</strong>
          <p>{sampleQuestion}</p>
        </div>
      </>}
      {step === 3 && <>
        <p>Select a numbered citation to see the passage behind it, plus the title, author, date and link when available.</p>
        <details className="walkthrough-example">
          <summary><BookOpen size={16} aria-hidden="true" /> View sample citation [S1]</summary>
          <blockquote>“An age check could confirm someone is old enough without revealing their exact birth date.”</blockquote>
          <small>Illustrative passage for this walkthrough</small>
        </details>
        <p>Open <strong>Article sources</strong> under an answer to review its sources and, when available, preview and copy a research brief.</p>
      </>}
      {lastStep && <>
        <p>Use <strong>Send to the team</strong> below an answer to report it. To report a specific citation, open <strong>Sources</strong> and use the button on that source. This works in AEI + Web too.</p>
        <p className="walkthrough-example walkthrough-feedback"><Flag size={17} aria-hidden="true" />
          <span>The team sees the answer or source you select and your explanation.</span>
        </p>
        <p>Try the example question to start a new Article Chat. You can edit it before sending.</p>
      </>}
    </div>
    <footer className="research-dialog-actions walkthrough-actions">
      <button type="button" className="walkthrough-dismiss" onClick={onClose}>{lastStep ? 'Done' : 'Skip tour'}</button>
      {step > 0 && <button type="button" className="research-secondary" onClick={() => setStep(step - 1)}>Back</button>}
      {lastStep
        ? <button type="button" className="research-primary" disabled={busy} onClick={() => onTryQuestion(sampleQuestion)}>Try the example question</button>
        : <button type="button" className="research-primary" onClick={() => setStep(step + 1)}>Next <ArrowRight size={16} aria-hidden="true" /></button>}
    </footer>
  </ResearchDialog>;
}
