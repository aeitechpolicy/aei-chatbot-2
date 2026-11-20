import { ClarificationChoices } from './ResearchFlow';
import InterviewDetails from './InterviewDetails';
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { User, Bot, BookOpen, ChevronDown, FileText, Flag, X, ArrowUpRight } from 'lucide-react';
import SourceCards from './SourceCards';
import { sourceLink, sourceDateLabel, sourceByline } from '../utils/sources';
import { buildResearchBrief } from '../utils/researchBrief';
import ResearchBriefPreview from './ResearchBriefPreview';
import FeedbackDialog from './FeedbackDialog';
import '../styles/MessageList.css';

// Recognize stored source-only replies too, so existing chats get the clearer
// presentation without rewriting their saved content or citation diagnostics.
const sourceOnlyReplies = new Set([
  'I found related articles in the AEI Scholar Library, but the answer did not pass the citation check. Open Article sources below to read the relevant passages.',
  'The answer did not pass the citation check. Open Sources below to review the library passages and web snippets.'
]);

function AnswerText({ content, sources = [], onSource }) {
  const tokens = /(\[[SW]\d+\]|\[Source:\s*[^\]\n]+\]|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  return String(content ?? '').replace(/^(\s*(?:[-*]\s+)?)([^*\n]{1,90}:)\*{1,2}\s*/gm, '$1$2 ').split('\n').map((line, index) => (
    <React.Fragment key={index}>
      {index > 0 && <br />}
      {line.split(tokens).map((part, tokenIndex) => {
        if (/^\[[SW]\d+\]$/.test(part)) {
          const source = sources.find(item => item?.id === part.slice(1, -1));
          return source
            ? <button type="button" key={tokenIndex} className="source-reference citation-button" aria-label={`View passage ${part}`} onClick={event => onSource(source, event.currentTarget)}>{part}</button>
            : <span key={tokenIndex}>{part}</span>;
        }
        if (part.startsWith('[Source:') && part.endsWith(']')) return <span className="inline-citation" key={tokenIndex}>{part.slice(8, -1).trim()}</span>;
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={tokenIndex}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={tokenIndex}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={tokenIndex}>{part.slice(1, -1)}</code>;
        return part;
      })}
    </React.Fragment>
  ));
}

function CitationPassage({ source, onClose }) {
  const close = useRef(null);
  useEffect(() => { close.current?.focus(); }, [source]);
  const url = sourceLink(source);
  return <aside className="citation-passage" aria-label={`Passage [${source.id}]`} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <div className="citation-passage-header">
      <span>{source.kind === 'web' ? 'Web search snippet' : 'AEI Scholar Library passage'} [{source.id}]</span>
      <button type="button" ref={close} onClick={onClose} aria-label="Close passage"><X size={16} /></button>
    </div>
    <h3>{source.title}</h3>
    <p className="source-metadata">{sourceByline(source)} · {sourceDateLabel(source)}</p>
    <InterviewDetails source={source} />
    <blockquote>{source.excerpt || source.body || 'Passage not available.'}</blockquote>
    {url && <a href={url} target="_blank" rel="noopener noreferrer">{source.kind === 'web' ? 'Open web source' : 'Open on AEI'} <ArrowUpRight size={14} /></a>}
  </aside>;
}

function ChatMessage({ message, title, chatId, messageIndex, onFollowUp, showFollowUps, onClarify, endMarker }) {
  const [selected, setSelected] = useState(null);
  const opener = useRef(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const feedbackHintId = useId();
  const isUser = message.role === 'user';
  const canReport = message.role === 'assistant' && chatId;
  const sources = message.sources || [];
  const comparison = message.comparison || [];
  const experimental = message.searchMode === 'web';
  const sourceOnly = !isUser && !comparison.length && sources.length > 0 && Boolean(message.citationNotice) && sourceOnlyReplies.has(message.content);
  const brief = !isUser && !sourceOnly && buildResearchBrief(message, title);

  function openSource(source, button) {
    opener.current = button;
    setSelected(source);
  }
  function closeSource() {
    setSelected(null);
    opener.current?.focus();
  }
  return <div className={`message ${message.role}`}>
    <div className="message-header">
      <div className="message-icon">{isUser ? <User size={20} /> : <Bot size={20} />}</div>
      <div className="message-role">{isUser ? 'Question' : 'Assistant'}</div>
      {!isUser && message.model === 'meta-models/Muse-Spark-Open-816B-A42B' && message.modelTest !== false && <span className="answer-mode-label">Meta Muse · Test</span>}
      {experimental && <span className="answer-mode-label">{message.webScope==='aei'?'AEI online':'AEI + Web'}</span>}
    </div>
    {experimental && <p className="answer-source-note">{message.webScope==='aei'?'Online excerpts by additional AEI authors; separate from the four-scholar library.':'Online search excerpts and library passages are labeled separately. Online excerpts may be incomplete.'}</p>}
    {experimental && message.webScope !== 'aei' && !sources.some(source => source?.id?.startsWith('S')) && <p className="answer-source-note">The web search returned results. The AEI Scholar Library has no matching passages for this question.</p>}
    {message.coverageNotice && <p className="answer-source-note">{message.coverageNotice}</p>}
    <div className={`message-evidence-layout ${selected ? 'has-passage' : ''}`}>
      <div className="message-content">
        {message.clarification&&onClarify ? null : sourceOnly ? <>
          <p>{experimental
            ? 'Related articles and web sources are shown below.'
            : 'Related articles from the AEI Scholar Library are shown below.'}</p>
          <section aria-label={experimental ? 'Related sources' : 'Related articles'}>
            <SourceCards sources={sources} chatFeedback={canReport ? { chatId, messageIndex } : undefined} />
          </section>
        </> : comparison.length ? <div className="scholar-comparison" aria-label="Scholar comparison">
          {comparison.map(group => {
            const source = sources.find(item => item?.id === group.sourceId);
            return <section key={group.scholar}>
              <h3>{group.scholar}</h3>
              <p><AnswerText content={group.content} sources={sources} onSource={openSource} /></p>
              {group.limited && source && <button type="button" className="source-reference citation-button" onClick={event => openSource(source, event.currentTarget)}>View passage [{source.id}]</button>}
            </section>;
          })}
        </div> : <AnswerText content={message.content} sources={sources} onSource={openSource} />}
      </div>
      {selected && <CitationPassage source={selected} onClose={closeSource} />}
    </div>
    {!isUser && message.clarification && onClarify && <ClarificationChoices clarification={message.clarification} onChoose={question=>onClarify(question)} onCustom={question=>onClarify(question)} />}
    {message.truncated && <p className="citation-notice citation-review-note" role="note">The output limit was reached. The response may be incomplete.</p>}
    {!sourceOnly && message.citationNotice && <p className={`citation-notice ${message.citationNotice.startsWith('Some passages were omitted') ? 'citation-review-note' : ''}`} role="note">{message.citationNotice.startsWith('Some passages were omitted')
      ? 'This answer was shortened after a source-reference or quotation check. Related passages remain available in the sources.'
      : message.citationNotice}</p>}
    {canReport && <div className="message-tools">
      {!feedbackSent && <span className="feedback-hint" id={feedbackHintId}>Something wrong with this answer?</span>}
      <button className="research-secondary" type="button" aria-describedby={feedbackSent ? undefined : feedbackHintId}
        onClick={() => setFeedbackOpen(true)} disabled={feedbackSent}>
        <Flag size={17} aria-hidden="true" /> {feedbackSent ? 'Sent to the team' : 'Send to the team'}
      </button>
    </div>}
    {!isUser && !sourceOnly && sources.length > 0 && <details className="article-source-details">
      <summary>
        <BookOpen size={17} aria-hidden="true" />
        <span>{experimental ? 'Sources' : 'Article sources'} ({sources.length})</span>
        <ChevronDown className="source-panel-chevron" size={17} aria-hidden="true" />
      </summary>
      <div className="source-panel-content">
        {brief && <button className="research-primary" type="button" onClick={() => setBriefOpen(true)}>
          <FileText size={17} aria-hidden="true" /> Preview research brief
        </button>}
        <SourceCards sources={sources} chatFeedback={canReport ? { chatId, messageIndex } : undefined} />
      </div>
    </details>}
    {brief && briefOpen && <ResearchBriefPreview brief={brief} onClose={() => setBriefOpen(false)} />}
    {canReport && feedbackOpen && <FeedbackDialog chatId={chatId} messageIndex={messageIndex} answer={message.content}
      sent={feedbackSent} onSent={() => setFeedbackSent(true)} onClose={() => setFeedbackOpen(false)} />}
    {endMarker}
    {showFollowUps && message.followUps?.length > 0 && <div className="message-follow-ups" aria-label="Suggested follow-up questions"><h3>Explore next</h3><p>Choose a question to place it in the message box.</p>
      {message.followUps.map(question => <button type="button" key={question} onClick={() => onFollowUp(question)}>{question}</button>)}
    </div>}
  </div>;
}

export default function MessageList({ messages, loading, title, chatId, onFollowUp, onClarify, onAnswerRead, revealNext=true }) {
  const latestTurnRef = useRef(null);
  const preparingRef = useRef(null);
  const answerEndRef = useRef(null);
  const readCallback = useRef(onAnswerRead);
  readCallback.current=onAnswerRead;
  const latest=messages.at(-1);
  useLayoutEffect(()=>{
    const target=loading?preparingRef.current:latestTurnRef.current;
    target?.scrollIntoView?.({behavior:'auto',block:'start'});
  },[chatId,messages.length,loading,latest?.content,latest?.role]);
  useEffect(()=>{
    const marker=answerEndRef.current;
    if(loading||latest?.role!=='assistant'||!marker||!readCallback.current)return undefined;
    const root=marker.closest('.messages-container');
    let done=false;
    const finish=()=>{if(!done){done=true;readCallback.current?.();}};
    if(typeof IntersectionObserver==='function'){
      const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))finish();},{root,threshold:1});
      observer.observe(marker);return()=>observer.disconnect();
    }
    const check=()=>{if(!root||root.clientHeight<=0)return;const end=marker.getBoundingClientRect(),box=root.getBoundingClientRect();if(end.top>=box.top&&end.bottom<=box.bottom)finish();};
    check();root?.addEventListener('scroll',check);
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(check):null;
    if(root)observer?.observe(root);
    return()=>{root?.removeEventListener('scroll',check);observer?.disconnect();};
  },[chatId,messages.length,loading,latest?.content,latest?.role]);
  return <div className="messages-list">
    {messages.map((message,index)=><div key={index} ref={index===messages.length-1?latestTurnRef:null} className="answer-turn">
      <ChatMessage message={message} title={title} chatId={chatId} messageIndex={index}
        onFollowUp={onFollowUp} onClarify={!loading&&index===messages.length-1?onClarify:undefined}
        endMarker={!loading&&index===messages.length-1&&message.role==='assistant'?<div ref={answerEndRef} className="answer-read-marker" aria-hidden="true" />:null}
        showFollowUps={Boolean(revealNext&&onFollowUp&&!loading&&index===messages.length-1)} />
    </div>)}
    {loading&&<div ref={preparingRef} className="message assistant">
      <div className="message-header"><div className="message-icon"><Bot size={20} /></div><div className="message-role">Assistant</div></div>
      <div className="message-content" role="status" aria-label="Preparing answer"><div className="typing-indicator"><span /><span /><span /></div></div>
    </div>}
  </div>;
}
