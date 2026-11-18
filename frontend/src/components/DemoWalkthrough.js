import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Copy, Flag, Globe, MessageCircle, RotateCcw, Search } from 'lucide-react';
import ResearchDialog from './ResearchDialog';
import ResearchBriefPreview from './ResearchBriefPreview';
import FeedbackDialog from './FeedbackDialog';
import { buildResearchBrief } from '../utils/researchBrief';

const sampleQuestion = 'What does Greg Oslan recommend for protecting personal accounts?';
const sampleSource = {
  id: 'S1', title: 'Why Is It So Hard to Stay Safe Online?', author: 'Shane Tews, Luke Hogg', date: '2026-11-12',
  url: 'https://www.aei.org/domestic-policy/why-is-it-so-hard-to-stay-safe-online/',
  excerpt: 'Greg Oslan: Checking whether your email address has been exposed in a breach is a relatively easy thing to do today. You can use tools that have been out there for a number of years, and they’ll quickly tell you which breaches may have exposed your email address.'
};
const answer = 'Oslan recommends checking whether account credentials have appeared in a breach and reviewing older accounts that still contain personal information. [S1]';
const brief = buildResearchBrief({ content: answer, sources: [sampleSource] }, 'Protecting personal accounts');
const steps = [
  { title: 'Choose a mode', help: 'Select AEI Article Search in the practice workspace. Article Chat answers from the Scholar Library; AEI + Web adds outside reporting.' },
  { title: 'Find an article', help: 'Type Greg Oslan, then select Search. In the real search, you can also choose a scholar, date range, or Newest first. Select results to copy a source list.' },
  { title: 'Open the citation', help: 'This prepared answer shows how citations work. Select [S1] to read the passage. A byline names the article’s authors; the passage identifies who is speaking.' },
  { title: 'Preview a research brief', help: 'Select Preview research brief. Review the findings and linked source before copying. This uses the answer already on screen.' },
  { title: 'Report a problem', help: 'Select Send to the team, choose a reason, and add an explanation. This practice form sends nothing. In real chats, staff see only the answer or source you report.' }
];
const modes = [
  { key: 'chat', label: 'Article Chat', icon: MessageCircle, text: 'Ask about Brent Orrell, Clay Calvert, Shane Tews and Will Rinehart using the AEI Scholar Library.' },
  { key: 'search', label: 'AEI Article Search', icon: Search, text: 'Find library articles by topic, title or scholar, inspect passages and open the originals on AEI.' },
  { key: 'web', label: 'AEI + Web', icon: Globe, text: 'Experimental answers combine library passages with outside reporting, clearly identified as web sources.' }
];

export default function DemoWalkthrough({ onClose, onTryQuestion, onOpenSearch, busy }) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [mode, setMode] = useState('chat');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [passage, setPassage] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const heading = useRef(null);
  const finished = step === steps.length;
  useEffect(() => { heading.current?.focus(); }, [step]);
  const mark = index => setCompleted(previous => previous.includes(index) ? previous : [...previous, index]);
  function restart() {
    setStep(0); setCompleted([]); setMode('chat'); setQuery(''); setResults(false); setSearchError('');
    setSelected(false); setCopyStatus(''); setPassage(false); setBriefOpen(false); setFeedbackOpen(false); setFeedbackSent(false);
  }
  function chooseMode(key) {
    setMode(key);
    if (step === 0 && key === 'search') { mark(0); setStep(1); }
  }
  function findArticle(event) {
    event.preventDefault();
    if (query.trim().replace(/\s+/g, ' ').toLowerCase() !== 'greg oslan') {
      setSearchError('For this practice example, search Greg Oslan. The real search accepts other topics and names.'); return;
    }
    setSearchError(''); setResults(true); mark(1);
  }
  async function copySourceList() {
    try {
      await navigator.clipboard.writeText(`${sampleSource.title}\n${sampleSource.author} · ${sampleSource.date}\n${sampleSource.url}`);
      setCopyStatus('Sample source list copied.');
    } catch { setCopyStatus('Clipboard access is unavailable. You can copy the title and link from the sample result.'); }
  }
  function continueTour() {
    const next = step + 1;
    if (next >= 2) setMode('chat');
    setStep(next);
  }
  return <ResearchDialog title="Try AEI Chatbot" onClose={onClose} className="guided-demo-dialog">
    <div className="guided-demo-intro"><span className="guided-demo-badge">Guided practice</span>
      <p>Try a prepared example. Nothing is sent to the chatbot or saved to your chat history.</p>
    </div>
    <div className="guided-demo-layout">
      <aside className="guided-demo-guide" aria-label="Tour checklist">
        <div className="walkthrough-progress"><span>{completed.length} of {steps.length} complete</span>
          <progress value={completed.length} max={steps.length} aria-label="Walkthrough progress" />
        </div>
        <ol className="guided-demo-checklist">{steps.map((item, index) => <li key={item.title}>
          <button type="button" disabled={index > step && !completed.includes(index)} aria-current={!finished && step === index ? 'step' : undefined}
            onClick={() => { setStep(index); setMode(index < 2 ? 'search' : 'chat'); }}>
            <span className={`guided-demo-step-number ${completed.includes(index) ? 'is-complete' : ''}`} aria-label={completed.includes(index) ? 'Completed' : `Step ${index + 1}`}>
              {completed.includes(index) ? <Check size={14} aria-hidden="true" /> : index + 1}
            </span>{item.title}
          </button>
        </li>)}</ol>
        <section className="guided-demo-coach" aria-live="polite">
          <p className="workspace-kicker">{finished ? 'Practice complete' : `Step ${step + 1}`}</p>
          <h3 ref={heading} tabIndex={-1}>{finished ? 'You’re ready to explore' : steps[step].title}</h3>
          <p>{finished ? 'Use the same controls in the real chatbot. Check the cited passages, keep interview speakers distinct, and report anything that needs attention.' : steps[step].help}</p>
        </section>
      </aside>
      <section className="guided-demo-workspace" aria-label="Practice workspace">
        <div className="guided-demo-workspace-heading"><strong>AEI Chatbot</strong><span>Prepared example</span></div>
        <nav className="guided-demo-modes" aria-label="Practice research modes">{modes.map(({key, label, icon: Icon}) => <button key={key} type="button"
          aria-pressed={mode === key} data-tour-focus={step === 0 && key === 'search'} onClick={() => chooseMode(key)}>
          <Icon size={15} aria-hidden="true" />{label}
        </button>)}</nav>
        {mode !== 'chat' && <p className="guided-demo-mode-description">{modes.find(item => item.key === mode).text}</p>}
        {mode === 'search' && <>
          <form className="guided-demo-search" data-tour-focus={step === 1 && !results} onSubmit={findArticle}>
            <label htmlFor="practice-query">Search the sample library</label>
            <div><input id="practice-query" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} placeholder="Greg Oslan" />
              <button type="submit" className="research-primary"><Search size={15} aria-hidden="true" /> Search</button></div>
          </form>
          {searchError && <p role="alert">{searchError}</p>}
          {results && <article className="guided-demo-result" data-tour-focus={step === 1 && results} aria-label="Practice search result">
            <p className="workspace-kicker">Edited interview highlights</p><h4>{sampleSource.title}</h4>
            <p>{sampleSource.author} · {sampleSource.date}</p>
            <p>Interview participants: Shane Tews, Greg Oslan</p>
            <a href={sampleSource.url} target="_blank" rel="noopener noreferrer">Open on AEI</a>
            <label className="source-selection"><input type="checkbox" checked={selected} onChange={event => setSelected(event.target.checked)} />Add to source list</label>
            <button type="button" className="research-secondary" disabled={!selected} onClick={copySourceList}><Copy size={14} aria-hidden="true" /> Copy source list</button>
            <p role="status">{copyStatus || 'This is the prepared result for this walkthrough.'}</p>
          </article>}
        </>}
        {mode === 'web' && <p className="guided-demo-placeholder">Web searches are not run in this practice space. Select AEI Article Search to begin the guided example.</p>}
        {mode === 'chat' && <>
          {step < 2 ? <p className="guided-demo-placeholder">Start with AEI Article Search. Later, you’ll explore a cited answer here.</p> : <>
            <p className="guided-demo-question"><strong>Example question</strong><br />{sampleQuestion}</p>
            <article className="guided-demo-answer" aria-label="Prepared sample answer">
              <p className="workspace-kicker">Prepared answer</p>
              <p>Oslan recommends checking whether account credentials have appeared in a breach and reviewing older accounts that still contain personal information.{' '}
                <button type="button" className="source-reference citation-button" data-tour-focus={step === 2 && !passage} aria-label="Open sample citation S1"
                  onClick={() => { setPassage(!passage); mark(2); }}>[S1]</button>
              </p>
              {passage && <section className="guided-demo-passage" data-tour-focus={step === 2 && passage} aria-label="Sample source passage">
                <h4>{sampleSource.title}</h4><p>{sampleSource.author} · {sampleSource.date}</p>
                <p><strong>Guest: Greg Oslan</strong></p><blockquote>{sampleSource.excerpt}</blockquote>
                <a href={sampleSource.url} target="_blank" rel="noopener noreferrer">Open on AEI</a>
              </section>}
              <div className="guided-demo-answer-actions">
                <button type="button" className="research-secondary" data-tour-focus={step === 3}
                  onClick={() => { setBriefOpen(true); mark(3); }}><BookOpen size={16} aria-hidden="true" /> Preview research brief</button>
                <button type="button" className="research-secondary" data-tour-focus={step === 4} onClick={() => setFeedbackOpen(true)}>
                  <Flag size={16} aria-hidden="true" /> Send to the team</button>
              </div>
              <p className="guided-demo-feedback-hint">Wrong or incomplete response? This is the button to use.</p>
            </article>
          </>}
        </>}
      </section>
    </div>
    <footer className="research-dialog-actions guided-demo-actions">
      <button type="button" className="walkthrough-dismiss" onClick={onClose}>{finished ? 'Close tour' : 'Skip tour'}</button>
      <button type="button" className="research-secondary" onClick={restart}><RotateCcw size={14} aria-hidden="true" /> Restart</button>
      {step > 0 && !finished && <button type="button" className="research-secondary" onClick={() => { setStep(step - 1); setMode(step - 1 < 2 ? 'search' : 'chat'); }}>Back</button>}
      {finished ? <>
        <button type="button" className="research-secondary" onClick={onOpenSearch}>Try real Article Search</button>
        <button type="button" className="research-primary" disabled={busy} onClick={() => onTryQuestion(sampleQuestion)}>Open this question in Article Chat</button>
      </> : <button type="button" className="research-primary" disabled={!completed.includes(step)} onClick={continueTour}>
        {step === steps.length - 1 ? 'Finish tour' : 'Next'} <ArrowRight size={15} aria-hidden="true" /></button>}
    </footer>
    {briefOpen && <ResearchBriefPreview brief={brief} onClose={() => setBriefOpen(false)} />}
    {feedbackOpen && <FeedbackDialog practice answer={answer} sent={feedbackSent} onSent={() => { setFeedbackSent(true); mark(4); }} onClose={() => setFeedbackOpen(false)} />}
  </ResearchDialog>;
}
