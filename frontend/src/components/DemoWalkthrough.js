import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Copy, Flag, Globe, MessageCircle, RotateCcw, Search } from 'lucide-react';
import ResearchDialog from './ResearchDialog';
import ResearchBriefPreview from './ResearchBriefPreview';
import FeedbackDialog from './FeedbackDialog';
import { buildResearchBrief } from '../utils/researchBrief';

const sampleQuestion = 'What does Greg Oslan recommend for protecting personal accounts?';
const sampleSource = {
  id: 'S1', title: 'Why Is It So Hard to Stay Safe Online?', author: 'Shane Tews', date: '2026-11-12',
  url: 'https://www.aei.org/domestic-policy/why-is-it-so-hard-to-stay-safe-online/',
  excerpt: 'Greg Oslan: Checking whether your email address has been exposed in a breach is a relatively easy thing to do today. You can use tools that have been out there for a number of years, and they’ll quickly tell you which breaches may have exposed your email address.'
};
const webSource = {
  id: 'W1', kind: 'web', title: 'How Do I Create a Good Password?', publisher: 'NIST', date: null,
  url: 'https://www.nist.gov/cybersecurity-and-privacy/how-do-i-create-good-password',
  excerpt: 'For accounts that require passwords, NIST experts highly recommend that you use a password manager.'
};
const answer = 'Oslan recommends checking whether account credentials have appeared in a breach and reviewing older accounts that still contain personal information. [S1]';
const brief = buildResearchBrief({ content: answer, sources: [sampleSource] }, 'Protecting personal accounts');
const steps = [
  { title: 'Choose a mode', help: 'Select AEI Article Search. Article Chat answers from the Scholar Library; AEI + Web adds outside material.' },
  { title: 'Find an article', help: 'Search Greg Oslan. In real search, you can also choose a scholar, date range, or Newest first. Select results to copy a source list.' },
  { title: 'Open the citation', help: 'Select [S1] to read the supporting passage. Shane Tews is the author of this article; Greg Oslan is the guest speaking in the passage.' },
  { title: 'Preview a research brief', help: 'Open the brief, review the findings and linked source, and copy the text if useful. It is made from the answer already on screen.' },
  { title: 'Try AEI + Web', help: 'Select AEI + Web, then [W1]. This prepared comparison connects the AEI interview with NIST guidance. [S1] identifies AEI evidence; [W1] identifies an outside source.' },
  { title: 'Report a problem', help: 'Select Send to the team, choose a reason, and explain what needs correcting. This practice form sends nothing. In real use, staff see the answer or source you report and your explanation.' }
];
const modes = [
  { key: 'chat', label: 'Article Chat', icon: MessageCircle },
  { key: 'search', label: 'AEI Article Search', icon: Search },
  { key: 'web', label: 'AEI + Web', icon: Globe }
];
export default function DemoWalkthrough({ onClose, onTryQuestion, onOpenSearch, busy, showWhatsNewLink = false }) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [mode, setMode] = useState('chat');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [passage, setPassage] = useState(false);
  const [webPassage, setWebPassage] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showing, setShowing] = useState(false);
  const heading = useRef(null);
  const run = useRef(0);
  const finished = step === steps.length;
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => () => { run.current++; }, []);
  const mark = index => setCompleted(previous => previous.includes(index) ? previous : [...previous, index]);
  function showStep(index) { setStep(index); setMode(index < 2 ? 'search' : index === 4 ? 'web' : 'chat'); }
  function restart() {
    run.current++; setShowing(false); setStep(0); setCompleted([]); setMode('chat'); setQuery(''); setResults(false); setSearchError('');
    setSelected(false); setCopyStatus(''); setPassage(false); setWebPassage(null); setBriefOpen(false); setFeedbackOpen(false); setFeedbackSent(false);
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
    try { await navigator.clipboard.writeText(`${sampleSource.title}\n${sampleSource.author} · ${sampleSource.date}\n${sampleSource.url}`); setCopyStatus('Sample source list copied.'); }
    catch { setCopyStatus('Clipboard access is unavailable. You can copy the title and link from the sample result.'); }
  }
  async function continueTour() {
    if (showing) return;
    if (completed.includes(step)) { showStep(step + 1); return; }
    const currentRun = ++run.current;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    setShowing(true);
    if (step === 0) setMode('search');
    if (step === 1) { setMode('search'); setQuery('Greg Oslan'); setSearchError(''); }
    if (step === 2) { setMode('chat'); setPassage(true); }
    if (step === 3) { setMode('chat'); setBriefOpen(true); }
    if (step === 4) setMode('web');
    if (step === 5) { setMode('chat'); setFeedbackOpen(true); }
    await wait(650);
    if (currentRun !== run.current) return;
    if (step === 1) setResults(true);
    if (step === 4) setWebPassage('W1');
    await wait(step === 5 ? 1100 : 750);
    if (currentRun !== run.current) return;
    mark(step); setBriefOpen(false); setFeedbackOpen(false); setShowing(false); showStep(step + 1);
  }
  function sourcePassage(source, name) {
    return <section className="guided-demo-passage" aria-label={name} data-tour-focus={source.id === 'W1' ? step === 4 : step === 2}>
      <h4>{source.title}</h4><p>{source.author || source.publisher} · {source.date || 'Publication date not recorded'}</p>
      {source.id === 'S1' && <p><strong>Guest: Greg Oslan</strong></p>}
      <blockquote>{source.excerpt}</blockquote><a href={source.url} target="_blank" rel="noopener noreferrer">{source.id === 'S1' ? 'Open on AEI' : 'Open outside source'}</a>
    </section>;
  }
  return <ResearchDialog title="Try AEI Chatbot" onClose={onClose} className="guided-demo-dialog">
    <div className="guided-demo-intro"><span className="guided-demo-badge">Guided practice</span><p>Try a prepared example. Nothing is sent to the chatbot or saved to your chat history.</p></div>
    <div className="guided-demo-layout">
      <aside className="guided-demo-guide" aria-label="Tour checklist">
        <div className="walkthrough-progress"><span>{completed.length} of {steps.length} complete</span><progress value={completed.length} max={steps.length} aria-label="Walkthrough progress" /></div>
        <ol className="guided-demo-checklist">{steps.map((item, index) => <li key={item.title}><button type="button" disabled={showing || (index > step && !completed.includes(index))} aria-current={!finished && step === index ? 'step' : undefined} onClick={() => showStep(index)}>
          <span className={`guided-demo-step-number ${completed.includes(index) ? 'is-complete' : ''}`} aria-label={completed.includes(index) ? 'Completed' : `Step ${index + 1}`}>{completed.includes(index) ? <Check size={14} aria-hidden="true" /> : index + 1}</span>{item.title}
        </button></li>)}</ol>
        <section className="guided-demo-coach" aria-live="polite"><p className="workspace-kicker">{finished ? 'Practice complete' : `Step ${step + 1}`}</p>
          <h3 ref={heading} tabIndex={-1}>{finished ? 'You’re ready to explore' : steps[step].title}</h3>
          <p>{finished ? 'Use the same controls in the real chatbot. Check the sources, keep interview speakers distinct, and report anything that needs attention.' : steps[step].help}</p>
          {!finished && <p className="guided-demo-assist">{showing ? 'Showing this step for you…' : 'Need a hand? Select Next and this step will be shown for you.'}</p>}
        </section>
      </aside>
      <section className={`guided-demo-workspace ${showing ? 'is-demonstrating' : ''}`} aria-label="Practice workspace" aria-busy={showing}>
        <div className="guided-demo-workspace-heading"><strong>AEI Chatbot</strong><span>Prepared example</span></div>
        <nav className="guided-demo-modes" aria-label="Practice research modes">{modes.map(({key, label, icon: Icon}) => <button key={key} type="button" disabled={showing} aria-pressed={mode === key} data-tour-focus={(step === 0 && key === 'search') || (step === 4 && key === 'web' && mode !== 'web')} onClick={() => chooseMode(key)}><Icon size={15} aria-hidden="true" />{label}</button>)}</nav>
        {mode === 'search' && <>
          <p className="guided-demo-mode-description">Find articles in the AEI Scholar Library.</p>
          <form className="guided-demo-search" data-tour-focus={step === 1 && !results} onSubmit={findArticle}><label htmlFor="practice-query">Search the sample library</label><div>
            <input id="practice-query" maxLength={200} disabled={showing} value={query} onChange={event => setQuery(event.target.value)} placeholder="Greg Oslan" />
            <button type="submit" className="research-primary" disabled={showing}><Search size={15} aria-hidden="true" /> Search</button>
          </div></form>
          {searchError && <p role="alert">{searchError}</p>}
          {results && <article className="guided-demo-result" data-tour-focus={step === 1} aria-label="Practice search result"><p className="workspace-kicker">Edited interview highlights</p><h4>{sampleSource.title}</h4><p>{sampleSource.author} · {sampleSource.date}</p><p>Interview participants: Shane Tews, Greg Oslan</p><a href={sampleSource.url} target="_blank" rel="noopener noreferrer">Open on AEI</a>
            <label className="source-selection"><input type="checkbox" checked={selected} onChange={event => setSelected(event.target.checked)} />Add to source list</label>
            <button type="button" className="research-secondary" disabled={!selected} onClick={copySourceList}><Copy size={14} aria-hidden="true" /> Copy source list</button><p role="status">{copyStatus || 'This is the prepared result for this walkthrough.'}</p>
          </article>}
        </>}
        {mode === 'web' && <>
          <p className="guided-demo-mode-description">AEI + Web brings outside context alongside the scholar material. This is a prepared example, not a live search or a claim about today’s news.</p>
          {step < 2 ? <p className="guided-demo-placeholder">Choose AEI Article Search to start, or select Next to have that step shown for you.</p> : <>
            <p className="guided-demo-question"><strong>Example question</strong><br />How does the AEI interview’s account-safety advice compare with NIST’s guidance?</p>
            <article className="guided-demo-answer" aria-label="Prepared AEI plus Web answer"><p><strong>AEI interview:</strong> Greg Oslan recommends checking whether an email address has appeared in data breaches. <button type="button" className="source-reference citation-button" aria-label="Open sample AEI web citation S1" onClick={() => setWebPassage('S1')}>[S1]</button></p>
              <p><strong>Outside guidance:</strong> NIST recommends a password manager for accounts requiring passwords. This adds a practical way to manage account credentials. <button type="button" className="source-reference citation-button" aria-label="Open sample web citation W1" data-tour-focus={step === 4 && webPassage !== 'W1'} onClick={() => { setWebPassage('W1'); mark(4); }}>[W1]</button></p>
              {webPassage && sourcePassage(webPassage === 'W1' ? webSource : sampleSource, webPassage === 'W1' ? 'Sample outside source passage' : 'Sample AEI web passage')}
            </article>
          </>}
        </>}
        {mode === 'chat' && <>{step < 2 ? <p className="guided-demo-placeholder">Start with AEI Article Search, or select Next to have the step shown for you.</p> : <>
          <p className="guided-demo-question"><strong>Example question</strong><br />{sampleQuestion}</p><article className="guided-demo-answer" aria-label="Prepared sample answer"><p className="workspace-kicker">Prepared answer</p>
            <p>Oslan recommends checking whether account credentials have appeared in a breach and reviewing older accounts that still contain personal information. <button type="button" className="source-reference citation-button" data-tour-focus={step === 2 && !passage} aria-label="Open sample citation S1" onClick={() => { setPassage(!passage); mark(2); }}>[S1]</button></p>
            {passage && sourcePassage(sampleSource, 'Sample source passage')}
            <div className="guided-demo-answer-actions"><button type="button" className="research-secondary" data-tour-focus={step === 3} onClick={() => { setBriefOpen(true); mark(3); }}><BookOpen size={16} aria-hidden="true" /> Preview research brief</button>
              <button type="button" className="research-secondary" data-tour-focus={step === 5} onClick={() => setFeedbackOpen(true)}><Flag size={16} aria-hidden="true" /> Send to the team</button></div>
            <p className="guided-demo-feedback-hint">Wrong or incomplete response? This is the button to use.</p>
          </article>
        </>}</>}
      </section>
    </div>
    <footer className="research-dialog-actions guided-demo-actions">{finished && <p className="guided-demo-return-hint">You can revisit this demo anytime using <strong>How to use</strong> at the top{showWhatsNewLink ? <>, or open <strong>What’s new</strong> to review the latest features</> : null}.</p>}<button type="button" className="walkthrough-dismiss" onClick={onClose}>{finished ? 'Close tour' : 'Skip tour'}</button>
      <button type="button" className="research-secondary" disabled={showing} onClick={restart}><RotateCcw size={14} aria-hidden="true" /> Restart</button>
      {step > 0 && !finished && <button type="button" className="research-secondary" disabled={showing} onClick={() => showStep(step - 1)}>Back</button>}
      {finished ? <><button type="button" className="research-secondary" onClick={onOpenSearch}>Try real Article Search</button><button type="button" className="research-primary" disabled={busy} onClick={() => onTryQuestion(sampleQuestion)}>Open this question in Article Chat</button></> : <button type="button" className="research-primary" disabled={showing} onClick={continueTour}>{step === steps.length - 1 ? 'Finish tour' : 'Next'} <ArrowRight size={15} aria-hidden="true" /></button>}
    </footer>
    {briefOpen && <ResearchBriefPreview brief={brief} onClose={() => setBriefOpen(false)} />}
    {feedbackOpen && <FeedbackDialog practice autoComplete={showing && step === 5} answer={answer} sent={feedbackSent} onSent={() => { setFeedbackSent(true); mark(5); }} onClose={() => setFeedbackOpen(false)} />}
  </ResearchDialog>;
}
