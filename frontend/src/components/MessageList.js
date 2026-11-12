import React, { useEffect, useId, useRef, useState } from 'react';
import { User, Bot, BookOpen, ChevronDown, FileText, Flag, X, ArrowUpRight } from 'lucide-react';
import SourceCards from './SourceCards';
import { sourceLink } from '../utils/sources';
import { buildResearchBrief } from '../utils/researchBrief';
import ResearchBriefPreview from './ResearchBriefPreview';
import FeedbackDialog from './FeedbackDialog';
import '../styles/MessageList.css';

function AnswerText({ content, sources = [], onSource }) {
  const tokens = /(\[[SW]\d+\]|\[Source:\s*[^\]\n]+\]|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  return String(content ?? '').split('\n').map((line, index) => (
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
  const event = source.sourceType === 'event';
  return <aside className="citation-passage" aria-label={`Passage [${source.id}]`} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <div className="citation-passage-header">
      <span>{source.kind === 'web' ? 'Web search snippet' : 'AEI Scholar Library passage'} [{source.id}]</span>
      <button type="button" ref={close} onClick={onClose} aria-label="Close passage"><X size={16} /></button>
    </div>
    <h3>{source.title}</h3>
    <p className="source-metadata">{event ? 'AEI event' : source.author || source.publisher || 'Author not recorded'} · {(event ? source.eventDate : source.date) || 'Date not recorded'}</p>
    <blockquote>{source.excerpt || source.body || 'Passage not available.'}</blockquote>
    {url && <a href={url} target="_blank" rel="noopener noreferrer">{source.kind === 'web' ? 'Open web source' : 'Open on AEI'} <ArrowUpRight size={14} /></a>}
  </aside>;
}

function ChatMessage({ message, title, chatId, messageIndex, onFollowUp, showFollowUps }) {
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
  const brief = !isUser && buildResearchBrief(message, title);
  const experimental = message.searchMode === 'web';

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
      <div className="message-role">{isUser ? 'You' : 'Assistant'}</div>
      {experimental && <span className="answer-mode-label">AEI + Web</span>}
    </div>
    {experimental && !sources.some(source => source?.id?.startsWith('S')) && <p className="answer-source-note">The web search returned results. The AEI Scholar Library has no matching passages for this question.</p>}
    <div className={`message-evidence-layout ${selected ? 'has-passage' : ''}`}>
      <div className="message-content">
        {comparison.length ? <div className="scholar-comparison" aria-label="Scholar comparison">
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
    {message.citationNotice && <p className="citation-notice" role="note">{message.citationNotice}</p>}
    {canReport && <div className="message-tools">
      {!feedbackSent && <span className="feedback-hint" id={feedbackHintId}>Something wrong with this answer?</span>}
      <button className="research-secondary" type="button" aria-describedby={feedbackSent ? undefined : feedbackHintId}
        onClick={() => setFeedbackOpen(true)} disabled={feedbackSent}>
        <Flag size={17} aria-hidden="true" /> {feedbackSent ? 'Sent to the team' : 'Send to the team'}
      </button>
    </div>}
    {!isUser && sources.length > 0 && <details className="article-source-details">
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
    {showFollowUps && message.followUps?.length > 0 && <div className="message-follow-ups" aria-label="Suggested follow-up questions">
      {message.followUps.map(question => <button type="button" key={question} onClick={() => onFollowUp(question)}>{question}</button>)}
    </div>}
  </div>;
}

export default function MessageList({ messages, loading, title, chatId, onFollowUp }) {
  const messagesEndRef = useRef(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [messages, loading]);
  return <div className="messages-list">
    {messages.map((message, index) => <ChatMessage key={index} message={message} title={title} chatId={chatId} messageIndex={index}
      onFollowUp={onFollowUp} showFollowUps={Boolean(onFollowUp && !loading && index === messages.length - 1)} />)}
    {loading && <div className="message assistant">
      <div className="message-header"><div className="message-icon"><Bot size={20} /></div><div className="message-role">Assistant</div></div>
      <div className="message-content" role="status" aria-label="Preparing answer"><div className="typing-indicator"><span /><span /><span /></div></div>
    </div>}
    <div ref={messagesEndRef} />
  </div>;
}
