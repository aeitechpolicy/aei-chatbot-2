import React, { useEffect, useRef } from 'react';
import { User, Bot } from 'lucide-react';
import SourceCards from './SourceCards';
import { safeSourceUrl } from '../utils/sources';
import '../styles/MessageList.css';

const MessageList = ({ messages, loading }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const formatMessageContent = (content, sources = []) => {
    // React renders source and model text safely without interpreting raw HTML.
    const tokens = /(\[S\d+\]|\[Source:\s*[^\]\n]+\]|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
    return String(content ?? '').split('\n').map((line, index) => (
        <React.Fragment key={index}>
          {index > 0 && <br />}
          {line.split(tokens).map((part, tokenIndex) => {
            if (/^\[S\d+\]$/.test(part)) {
              const source = sources.find(s => typeof s === 'object' && s.id === part.slice(1, -1));
              const url = safeSourceUrl(source?.url);
              return url ? <a key={tokenIndex} className="source-reference" href={url} target="_blank" rel="noopener noreferrer" title={source.title}>{part}</a> : <span key={tokenIndex}>{part}</span>;
            }
            if (part.startsWith('[Source:') && part.endsWith(']')) return <span className="inline-citation" key={tokenIndex}>📄 {part.slice(8, -1).trim()}</span>;
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={tokenIndex}>{part.slice(2, -2)}</strong>;
            if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={tokenIndex}>{part.slice(1, -1)}</em>;
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={tokenIndex}>{part.slice(1, -1)}</code>;
            return part;
          })}
        </React.Fragment>
      ));
  };

  return (
    <div className="messages-list">
      {messages.length === 0 && !loading && (
        <div className="welcome-message">
          <div className="welcome-content">
            <h3>Welcome to AEI Chatbot! 👋</h3>
            <p>Ask about the scholars’ work, or open Article Search to find passages in the Scholar Archive.</p>
            <div className="welcome-tips">
              <div className="tip">
                <strong>💡 Tip:</strong> Try asking about specific topics or scholars
              </div>
              <div className="tip">
                <strong>📚 Explore:</strong> Use General for sources across scholars, or choose a specific scholar
              </div>
            </div>
          </div>
        </div>
      )}
      
      {messages.map((message, index) => (
        <div key={index} className={`message ${message.role}`}>
          <div className="message-header">
            <div className="message-icon">
              {message.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className="message-role">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>
          </div>
          
          <div className="message-content">
            {formatMessageContent(message.content, message.sources)}
          </div>

          {message.citationNotice && <p className="citation-notice" role="note">{message.citationNotice}</p>}
          {message.role === 'assistant' && message.sources?.length > 0 && <details className="article-source-details">
            <summary>Article sources ({message.sources.length})</summary>
            <SourceCards sources={message.sources} />
          </details>}
        </div>
      ))}
      
      {loading && (
        <div className="message assistant">
          <div className="message-header">
            <div className="message-icon">
              <Bot size={20} />
            </div>
            <div className="message-role">Assistant</div>
          </div>
          <div className="message-content">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
