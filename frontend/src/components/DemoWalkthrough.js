import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Flag, Globe, MessageCircle, Search } from 'lucide-react';
import ResearchDialog from './ResearchDialog';

const sampleQuestion = 'What tradeoffs do the scholars discuss around online age verification?';
const steps = ['Choose a research mode', 'Ask your first question', 'Check the sources', 'Help improve an answer'];
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

export default function DemoWalkthrough({ onClose, onTryQuestion, busy }) {
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
        <p>In <strong>Article Chat</strong>, search across all four scholars or pick one before sending your first question. Turn on <strong>Compare scholars</strong> to see their perspectives side by side where the library has evidence.</p>
        <div className="walkthrough-example">
          <strong>Example question</strong>
          <p>{sampleQuestion}</p>
        </div>
      </>}
      {step === 2 && <>
        <p>Select a numbered citation to see the passage behind it, plus the title, author, date and link when available.</p>
        <details className="walkthrough-example">
          <summary><BookOpen size={16} aria-hidden="true" /> View sample citation [S1]</summary>
          <blockquote>“An age check could confirm someone is old enough without revealing their exact birth date.”</blockquote>
          <small>Illustrative passage for this walkthrough</small>
        </details>
        <p>Open <strong>Article sources</strong> under an answer to review its sources and, when available, preview and copy a research brief.</p>
      </>}
      {lastStep && <>
        <p>Spot an error, missing context or a citation problem? Use <strong>Send to the team</strong> below the answer and describe what went wrong.</p>
        <p className="walkthrough-example walkthrough-feedback"><Flag size={17} aria-hidden="true" />
          <span>The team sees the answer you report and your explanation.</span>
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
