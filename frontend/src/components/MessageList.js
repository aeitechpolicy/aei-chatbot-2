import React, { useEffect, useRef } from 'react';
import { User, Bot, FileText, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import '../styles/MessageList.css';

const MessageList = ({ messages, loading }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const SourceFiles = ({ sources }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    if (!sources || sources.length === 0) return null;

    return (
      <div className="source-files">
        <button
          className="source-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          title={`${isExpanded ? 'Hide' : 'Show'} source files`}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <FileText size={16} />
          <span>Source Files ({sources.length})</span>
        </button>
        
        {isExpanded && (
          <div className="source-list">
            {sources.map((source, index) => (
              <div key={index} className="source-item">
                <ExternalLink size={12} />
                <span className="source-name">{source}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const formatMessageContent = (content) => {
    // React renders source and model text safely without interpreting raw HTML.
    const tokens = /(\[Source:\s*[^\]\n]+\]|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
    return String(content ?? '').split('\n').map((line, index) => (
        <React.Fragment key={index}>
          {index > 0 && <br />}
          {line.split(tokens).map((part, tokenIndex) => {
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
            <p>Start a conversation by asking questions about the knowledge base.</p>
            <div className="welcome-tips">
              <div className="tip">
                <strong>💡 Tip:</strong> Try asking about specific topics or scholars
              </div>
              <div className="tip">
                <strong>📚 Explore:</strong> Switch between different knowledge domains
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
            {formatMessageContent(message.content)}
          </div>

          {message.role === 'assistant' && message.sources && (
            <SourceFiles sources={message.sources} />
          )}
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
