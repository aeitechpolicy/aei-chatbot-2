import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Copy, Flag, Globe, MessageCircle, RotateCcw, Search } from 'lucide-react';
import ResearchDialog from './ResearchDialog';
import ResearchBriefPreview from './ResearchBriefPreview';
import FeedbackDialog from './FeedbackDialog';
import { ModeChoice } from './ResearchFlow';
import { SCHOLARS } from '../utils/scholars';
import { buildResearchBrief } from '../utils/researchBrief';

// Newly written guided-practice material based on public sources, not saved user chats.
const sampleQuestion = 'What options could expand rural connectivity?';
const sampleSource = {
  id:'S1', title:'Rural Broadband Requires Out-of-the-Box Thinking', author:'Shane Tews and Joel Thayer', date:'2022-04-20',
  url:'https://www.aei.org/commentary/rural-broadband-requires-out-of-the-box-thinking/',
  excerpt:'America needs and deserves an all-of-the above approach to ensure every family can connect with 5G.'
};
const webSource = {
  id:'W1', kind:'web', title:'How to Use the FCC’s National Broadband Map', publisher:'Federal Communications Commission', date:null,
  url:'https://help.bdc.fcc.gov/hc/en-us/articles/10467446103579-How-to-Use-the-FCC-s-National-Broadband-Map',
  excerpt:'The FCC map lists fixed broadband technologies available at individual homes and small businesses, including fiber, cable, DSL, satellite and fixed wireless.',
  practiceSummary:true
};
const answer = 'The authors advocate using several approaches to extend rural connectivity rather than relying on a single route. [S1]';
const brief = buildResearchBrief({content:answer,sources:[sampleSource]},'Rural Connectivity Options');
const steps = [
  { title: 'Choose a mode', help: 'Select AEI Article Search. Article Chat answers from the Scholar Library; Compare Scholars supports selected-scholar comparisons; AEI + Web adds outside material.' },
  { title: 'Find an article', help: 'Search rural broadband. Live search also includes scholar filters, date ranges, and Newest first. Select results to copy a source list.' },
  { title: 'Open the citation', help: 'Select [S1] to read the supporting passage. The byline names Shane Tews and Joel Thayer; the source date identifies this as a historical publication.' },
  { title: 'Preview a research brief', help: 'Open the brief, review the findings and linked source, and copy the text if useful. It selects concise findings from the answer already on screen, including important qualifications.' },
  { title: 'Try AEI + Web', help: 'Select AEI + Web, then [W1]. This newly written practice comparison connects a public AEI article with FCC information. [S1] identifies AEI evidence; [W1] identifies an outside source.' },
  { title: 'Report a problem', help: 'Select Send to the team, choose a reason, and explain what needs correcting. This practice form sends nothing. In real use, staff receive the reported answer or source and the submitted explanation.' },
  { title: 'Compare selected scholars', help: 'Open Compare Scholars and select two to four names. Ask one question to compare perspectives side by side. The live answer uses only the selected scholars and flags limited evidence. This practice shows the controls, not generated findings.' },
  { title: 'Choose the next research direction', help: 'Continue in Article Chat, explore AEI online, or add the wider web. Each choice waits for a selection and Send. Online excerpts remain separate from the four-scholar library.' },
  { title: 'Follow a topic and find updates', help: 'Follow this topic opens a source-scope choice. Topic inbox keeps updates private. At sign in, due topics are checked once every 24 hours. Check for updates runs a manual check at any time. Discuss in chat offers a mode choice before continuing.' }
];
const modes = [
  { key: 'chat', label: 'Article Chat', icon: MessageCircle },
  { key: 'compare', label: 'Compare Scholars', icon: BookOpen },
  { key: 'search', label: 'AEI Article Search', icon: Search },
  { key: 'web', label: 'AEI + Web', icon: Globe }
];
export default function DemoWalkthrough({ onClose, onTryQuestion, onOpenSearch, busy, showWhatsNewLink = false }) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [mode, setMode] = useState('chat');
  const [comparisonScholars, setComparisonScholars] = useState([]);
  const [query, setQuery] = useState('');
  const [practiceScope,setPracticeScope]=useState('library');
  const [practiceFollow,setPracticeFollow]=useState(false);
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
  const completionHeading = useRef(null);
  const run = useRef(0);
  const finished = step === steps.length;
  useEffect(() => {
    if (finished) {
      completionHeading.current?.focus({preventScroll:true});
    } else heading.current?.focus({preventScroll:true});
  }, [step, finished]);
  useEffect(() => () => { run.current++; }, []);
  const mark = index => setCompleted(previous => previous.includes(index) ? previous : [...previous, index]);
  function showStep(index) { setStep(index); setMode(index < 2 ? 'search' : index === 4 ? 'web' : index === 6 ? 'compare' : 'chat'); }
  function restart() {
    run.current++; setShowing(false); setStep(0); setCompleted([]); setMode('chat'); setQuery(''); setResults(false); setSearchError('');
    setSelected(false); setCopyStatus(''); setPassage(false); setWebPassage(null); setBriefOpen(false); setFeedbackOpen(false); setFeedbackSent(false); setComparisonScholars([]);
  }
  function chooseMode(key) {
    setMode(key);
    if (step === 0 && key === 'search') mark(0);
  }
  function findArticle(event) {
    event.preventDefault();
    if (query.trim().replace(/\s+/g, ' ').toLowerCase() !== 'rural broadband') {
      setSearchError('For this practice example, search rural broadband. The real search accepts other topics and names.'); return;
    }
    setSearchError(''); setResults(true); mark(1);
  }
  async function copySourceList() {
    try { await navigator.clipboard.writeText(`${sampleSource.title}\n${sampleSource.author} · ${sampleSource.date}\n${sampleSource.url}`); setCopyStatus('Sample source list copied.'); }
    catch { setCopyStatus('Clipboard access is unavailable. The sample title and link can be copied manually.'); }
  }
  function advanceTour() {
    run.current++; setShowing(false); setBriefOpen(false); setFeedbackOpen(false); showStep(step + 1);
  }
  async function continueTour() {
    if (showing) return;
    if (completed.includes(step)) { advanceTour(); return; }
    const currentRun = ++run.current;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    setShowing(true);
    if (step === 0) setMode('search');
    if (step === 1) { setMode('search'); setQuery('rural broadband'); setSearchError(''); }
    if (step === 2) { setMode('chat'); setPassage(true); }
    if (step === 3) { setMode('chat'); setBriefOpen(true); }
    if (step === 4) setMode('web');
    if (step === 5) { setMode('chat'); setFeedbackOpen(true); }
    if (step === 7) setPracticeScope('aei');
    if (step === 8) setPracticeFollow(true);
    if (step === 6) { setMode('compare'); setComparisonScholars(['Clay_Calvert', 'Shane_Tews']); }
    await wait(650);
    if (currentRun !== run.current) return;
    if (step === 1) setResults(true);
    if (step === 4) setWebPassage('W1');
    mark(step); setShowing(false);
  }
  function sourcePassage(source, name) {
    return <section className="guided-demo-passage" aria-label={name} data-tour-focus={source.id === 'W1' ? step === 4 : step === 2}>
      <h4>{source.title}</h4><p>{source.author || source.publisher} · {source.date || 'Publication date not recorded'}</p>
      {source.id === 'S1' && <p><strong>Public article · Two coauthors</strong></p>}
      {source.practiceSummary && <p>Original practice summary of a public source; not a direct quotation.</p>}
      <blockquote>{source.excerpt}</blockquote><a href={source.url} target="_blank" rel="noopener noreferrer">{source.id === 'S1' ? 'Open on AEI' : 'Open federal source'}</a>
    </section>;
  }
  return <ResearchDialog paged scrollKey={step} title="Try AEI Chatbot" onClose={onClose} className="guided-demo-dialog">
    {!finished && <>
    {step === 0 && <>
    <div className="guided-demo-intro"><span className="guided-demo-badge">Guided practice</span><p>Explore newly written practice material based on public sources. No user conversations are used. Practice activity is not sent to the chatbot or saved to chat history.</p></div>
    <details key={`explanation-${step}`} className="guided-demo-explanation"><summary>How answers are generated · Meta Muse Spark Open</summary><section className="guided-demo-generation" aria-label="How answers are generated">
      <h3>How answers are generated</h3>
      <p>Each question starts with a search for relevant passages from the selected scholars. Meta Muse Spark Open then drafts a response using those passages and adds numbered source references. AEI + Web also includes outside search results, labelled separately.</p>
      <p>A source check looks for missing references and checks longer quotations against the supplied passages. When wording needs further review, a shorter answer or related articles may appear instead. Source links and excerpts remain available for closer reading.</p>
      <p><strong>Responses are actively being fine-tuned.</strong> Reports submitted through <strong>Send to the team</strong> help improve relevance, wording, and source quality.</p>
    </section></details>
    </>}
    <div className="guided-demo-layout">
      <aside className="guided-demo-guide" aria-label="Tour checklist">
        <div className="walkthrough-progress"><span>{completed.length} of {steps.length} complete</span><progress value={completed.length} max={steps.length} aria-label="Walkthrough progress" /></div>
        <details key={`checklist-${step}`} className="guided-demo-step-list"><summary>View all nine steps</summary><ol className="guided-demo-checklist">{steps.map((item, index) => <li key={item.title}><button type="button" disabled={showing || (index > step && !completed.includes(index))} aria-current={!finished && step === index ? 'step' : undefined} onClick={() => showStep(index)}>
          <span className={`guided-demo-step-number ${completed.includes(index) ? 'is-complete' : ''}`} aria-label={completed.includes(index) ? 'Completed' : `Step ${index + 1}`}>{completed.includes(index) ? <Check size={14} aria-hidden="true" /> : index + 1}</span>{item.title}
        </button></li>)}</ol></details>
        <section className="guided-demo-coach" aria-live="polite"><p className="workspace-kicker">{finished ? 'Practice complete' : `Step ${step + 1}`}</p>
          <h3 ref={heading} tabIndex={-1}>{finished ? 'Ready to explore' : steps[step].title}</h3>
          <p>{finished ? 'Use the same controls in the real chatbot. Check the sources, keep interview speakers distinct, and report anything that needs attention.' : steps[step].help}</p>
          {!finished && <p className="guided-demo-assist">{showing ? 'Demonstrating this step…' : completed.includes(step) ? `Review this step, then select ${step === steps.length - 1 && completed.includes(step) ? 'Finish tour' : 'Next'} to continue.` : 'Select Next for a demonstration. The step remains open for review; select Next again to continue.'}</p>}
        </section>
      </aside>
      <section className={`guided-demo-workspace ${showing ? 'is-demonstrating' : ''}`} aria-label="Practice workspace" aria-busy={showing}>
        <div className="guided-demo-workspace-heading"><strong>AEI Chatbot</strong><span>Prepared example</span></div>
        <nav className="guided-demo-modes" aria-label="Practice research modes">{modes.map(({key, label, icon: Icon}) => <button key={key} type="button" disabled={showing} aria-pressed={mode === key} data-tour-focus={(step === 0 && key === 'search') || (step === 4 && key === 'web' && mode !== 'web')} onClick={() => chooseMode(key)}><Icon size={15} aria-hidden="true" />{label}</button>)}</nav>
        {step === 7 && <ModeChoice current={practiceScope} disabled={showing} onChoose={scope=>{setPracticeScope(scope);mark(7);}} />}
        {step === 8 && <section className="topic-card"><h3>Practice: follow this topic</h3><p>Prepared example · No check or save is performed.</p><fieldset className="follow-topic-form"><legend>Choose a source scope</legend>{['library','aei','web'].map(scope=><label key={scope}><input type="radio" name="practice-follow" checked={practiceScope===scope} onChange={()=>setPracticeScope(scope)} />{scope==='library'?'Scholar Library':scope==='aei'?'AEI online':'Wider web'}</label>)}</fieldset><button type="button" className="research-secondary" onClick={()=>{setPracticeFollow(true);mark(8);}}>Follow this topic</button>{practiceFollow&&<div className="topic-update"><h4>Topic inbox · Example</h4><p>First-check match · New publication related to this chat.</p><p>At sign in, due topics are checked once every 24 hours. Manual checks are available from Topic inbox.</p><button type="button" className="research-secondary" onClick={()=>mark(8)}>Discuss in chat</button></div>}</section>}
        {mode === 'compare' && <>
          <p className="guided-demo-mode-description">Choose two to four scholars, then ask the same question about the selected publications.</p>
          <fieldset className="chat-scope-picker"><legend>Practice: choose scholars to compare</legend>
            {Object.entries(SCHOLARS).map(([key, name]) => <button type="button" key={key} disabled={showing} aria-pressed={comparisonScholars.includes(key)} onClick={() => {
              const next = comparisonScholars.includes(key) ? comparisonScholars.filter(item => item !== key) : [...comparisonScholars, key];
              setComparisonScholars(next); if (step === 6 && next.length >= 2) mark(6);
            }}>{name}</button>)}
          </fieldset>
          <p role="status">{comparisonScholars.length < 2 ? 'Select at least two scholars, or use Next to see an example.' : 'The comparison would include the selected scholars.'}</p>
          <div className="scholar-comparison" aria-label="Practice selected scholars">{comparisonScholars.map(key => <section key={key}><h3>{SCHOLARS[key]}</h3><p>The live comparison would show this scholar’s perspective, supporting sources, and any limits in the evidence.</p></section>)}</div>
        </>}
        {mode === 'search' && <>
          <p className="guided-demo-mode-description">Find articles in the AEI Scholar Library.</p>
          <form className="guided-demo-search" data-tour-focus={step === 1 && !results} onSubmit={findArticle}><label htmlFor="practice-query">Search the sample library</label><div>
            <input id="practice-query" maxLength={200} disabled={showing} value={query} onChange={event => setQuery(event.target.value)} placeholder="rural broadband" />
            <button type="submit" className="research-primary" disabled={showing}><Search size={15} aria-hidden="true" /> Search</button>
          </div></form>
          {searchError && <p role="alert">{searchError}</p>}
          {results && <article className="guided-demo-result" data-tour-focus={step === 1} aria-label="Practice search result"><p className="workspace-kicker">Public article · Historical example</p><h4>{sampleSource.title}</h4><p>{sampleSource.author} · {sampleSource.date}</p><p>Newly written practice example based on a public publication.</p><a href={sampleSource.url} target="_blank" rel="noopener noreferrer">Open on AEI</a>
            <label className="source-selection"><input type="checkbox" checked={selected} onChange={event => setSelected(event.target.checked)} />Add to source list</label>
            <button type="button" className="research-secondary" disabled={!selected} onClick={copySourceList}><Copy size={14} aria-hidden="true" /> Copy source list</button><p role="status">{copyStatus || 'This is the prepared result for this walkthrough.'}</p>
          </article>}
        </>}
        {mode === 'web' && <>
          <p className="guided-demo-mode-description">AEI + Web brings outside context alongside the scholar material. This is a prepared example, not a live search or a claim about today’s news.</p>
          {step < 2 ? <p className="guided-demo-placeholder">Choose AEI Article Search to start, or select Next to see a demonstration of that step.</p> : <>
            <p className="guided-demo-question"><strong>Example question</strong><br />How could a public connectivity argument relate to checking local broadband availability?</p>
            <article className="guided-demo-answer" aria-label="Prepared AEI plus Web answer"><p><strong>AEI article:</strong> The authors advocate several approaches to extending rural connectivity. <button type="button" className="source-reference citation-button" aria-label="Open sample AEI web citation S1" onClick={() => setWebPassage('S1')}>[S1]</button></p>
              <p><strong>Federal background:</strong> The FCC map lists technology options available at individual locations. This adds background for checking local availability, rather than establishing which approach is best for every community. <button type="button" className="source-reference citation-button" aria-label="Open sample web citation W1" data-tour-focus={step === 4 && webPassage !== 'W1'} onClick={() => { setWebPassage('W1'); mark(4); }}>[W1]</button></p>
              {webPassage && sourcePassage(webPassage === 'W1' ? webSource : sampleSource, webPassage === 'W1' ? 'Sample outside source passage' : 'Sample AEI web passage')}
            </article>
          </>}
        </>}
        {mode === 'chat' && <>{step < 2 ? <p className="guided-demo-placeholder">Start with AEI Article Search, or select Next to see a demonstration of the step.</p> : <>
          <p className="guided-demo-question"><strong>Example question</strong><br />{sampleQuestion}</p><article className="guided-demo-answer" aria-label="Prepared sample answer"><p className="workspace-kicker">Prepared answer</p>
            <p>The authors advocate using several approaches to extend rural connectivity rather than relying on a single route. <button type="button" className="source-reference citation-button" data-tour-focus={step === 2 && !passage} aria-label="Open sample citation S1" onClick={() => { setPassage(!passage); mark(2); }}>[S1]</button></p>
            {passage && sourcePassage(sampleSource, 'Sample source passage')}
            <div className="guided-demo-answer-actions"><button type="button" className="research-secondary" data-tour-focus={step === 3} onClick={() => { setBriefOpen(true); mark(3); }}><BookOpen size={16} aria-hidden="true" /> Preview research brief</button>
              <button type="button" className="research-secondary" data-tour-focus={step === 5} onClick={() => setFeedbackOpen(true)}><Flag size={16} aria-hidden="true" /> Send to the team</button></div>
            <p className="guided-demo-feedback-hint">Wrong or incomplete response? This is the button to use.</p>
          </article>
        </>}</>}
      </section>
    </div>
    </>}
    {finished && <section className="guided-demo-return-guide" aria-label="Where to find help again">
      <p className="workspace-kicker">{completed.length} of {steps.length} complete</p>
      <h3 ref={completionHeading} tabIndex={-1}>Help is always available</h3>
      <p>Look in the <strong>top-right corner of the chatbot</strong>, as shown in the picture below.</p>
      <ol>
        {showWhatsNewLink && <li><strong>What’s new</strong> — review the latest features and the before-and-after comparison.</li>}
        <li><strong>How to use</strong> — replay this guided demo at any time.</li>
      </ol>
      <figure><div className={`guided-demo-help-picture ${showWhatsNewLink ? 'has-whats-new' : ''}`}>
        <img src={showWhatsNewLink ? '/tour-help-header.png' : '/tour-help-how-to.png'} alt={showWhatsNewLink ? 'Screenshot of the top-right chatbot toolbar showing What’s new and How to use next to each other.' : 'Screenshot of the How to use button at the top of the chatbot.'} />
        {showWhatsNewLink && <span className="help-picture-marker marker-whats-new" aria-hidden="true">1</span>}
        <span className="help-picture-marker marker-how-to" aria-hidden="true">{showWhatsNewLink ? '2' : '1'}</span>
      </div><figcaption>This picture shows where to look. After closing the tour, use these buttons at the top of the chatbot.</figcaption></figure>
    </section>}
    <footer className="research-dialog-actions guided-demo-actions"><button type="button" className="walkthrough-dismiss" onClick={onClose}>{finished ? 'Close tour' : 'Skip tour'}</button>
      <button type="button" className="research-secondary" disabled={showing} onClick={restart}><RotateCcw size={14} aria-hidden="true" /> Restart</button>
      {step > 0 && !finished && <button type="button" className="research-secondary" disabled={showing} onClick={() => showStep(step - 1)}>Back</button>}
      {finished ? <><button type="button" className="research-secondary" onClick={onOpenSearch}>Try real Article Search</button><button type="button" className="research-primary" disabled={busy} onClick={() => onTryQuestion(sampleQuestion)}>Open this question in Article Chat</button></> : <button type="button" className="research-primary" disabled={showing} onClick={continueTour}>{step === steps.length - 1 && completed.includes(step) ? 'Finish tour' : 'Next'} <ArrowRight size={15} aria-hidden="true" /></button>}
    </footer>
    {briefOpen && <ResearchBriefPreview brief={brief} onClose={() => setBriefOpen(false)} onContinue={step === 3 ? () => { mark(3); advanceTour(); } : undefined} />}
    {feedbackOpen && <FeedbackDialog practice autoFill={showing && step === 5} onContinue={step === 5 ? () => { mark(5); advanceTour(); } : undefined} answer={answer} sent={feedbackSent} onSent={() => { setFeedbackSent(true); mark(5); }} onClose={() => setFeedbackOpen(false)} />}
  </ResearchDialog>;
}
