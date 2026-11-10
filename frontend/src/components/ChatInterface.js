import React, { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import { Send } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../utils/api';
import { SCHOLARS, SCHOLAR_NAMES } from '../utils/scholars';
import '../styles/ChatInterface.css';

const ChatInterface = ({ 
  active,
  chatId,
  draftScope,
  onScopeChange,
  loading, 
  onSendMessage 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [currentChat, setCurrentChat] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [chatLoadError, setChatLoadError] = useState(false);
  const inputRef = useRef(null);
  const chatLoadVersion = useRef(0);

  // Load current chat when chatId changes
  useEffect(() => {
    if (chatId) {
      loadCurrentChat();
    } else {
      ++chatLoadVersion.current;
      setCurrentChat(null);
      setInputValue('');
      setSendError(null);
      setChatLoadError(false);
    }
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCurrentChat = async () => {
    if (!chatId) return;
    const version = ++chatLoadVersion.current;
    
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/chat/${chatId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const chat = await response.json();
        if (version === chatLoadVersion.current) setCurrentChat(chat);
        return;
      }
      if (version === chatLoadVersion.current) setChatLoadError(true);
    } catch (error) {
      if (version === chatLoadVersion.current) setChatLoadError(true);
      console.error('Error loading current chat:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputValue.trim() && !composerDisabled) {
      setSendingMessage(true);
      setSendError(null);
      const messageToSend = inputValue;
      
      // Add the user message optimistically to the UI
      const userMessage = {
        role: 'user',
        content: messageToSend,
        timestamp: new Date().toISOString()
      };
      
      setCurrentChat(prev => ({
        ...prev,
        domainName: scope,
        messages: [...(prev?.messages || []), userMessage]
      }));
      
      setInputValue(''); // Clear input immediately for better UX
      
      try {
        const result = await onSendMessage(messageToSend);
        
        // The API response contains the AI response, so we can add it directly
        if (result && result.response) {
          ++chatLoadVersion.current;
          if (result.chat) {
            setCurrentChat(result.chat);
            return;
          }
          const aiMessage = {
            role: 'assistant',
            content: result.response,
            sources: result.sources || [],
            citationNotice: result.citationNotice,
            timestamp: new Date().toISOString()
          };
          
          setCurrentChat(prev => ({
            ...prev,
            id: result.chatId || chatId,
            messages: [...(prev?.messages || []), aiMessage]
          }));
        }
        
      } catch (error) {
        console.error('Error sending message:', error);
        // Remove the optimistic message and restore input on error
        setCurrentChat(prev => ({
          ...prev,
          messages: prev?.messages?.slice(0, -1) || []
        }));
        setInputValue(messageToSend);
        setSendError(
          error.code === 'credit_limit'
            ? 'Together.ai credits exhausted - please contact admin.'
            : (error.message || 'The answer could not be completed. Please try again.')
        );
      } finally {
        setSendingMessage(false);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (sendError) setSendError(null);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  };

  useEffect(() => {
    if (active && inputRef.current && !sendingMessage && !loading) {
      inputRef.current.focus();
    }
  }, [active, currentChat, sendingMessage, loading]);

  const scope = (chatId && currentChat?.domainName) || draftScope;
  const chatReady = !chatId || currentChat?.id === chatId;
  const composerDisabled = sendingMessage || loading || !chatReady;
  const empty = chatReady && !currentChat?.messages?.length && !sendingMessage && !loading;

  return (
    <div className={`chat-interface ${empty ? 'workspace-start' : ''}`}>
      {empty ? (
        <div className="workspace-intro">
          <p className="workspace-kicker">AEI Chatbot</p>
          <h2>What would you like to explore?</h2>
          <p>Ask a question about our scholars’ work.</p>
        </div>
      ) : (
        <div className="messages-container">
          {chatLoadError && !chatReady ? (
            <p className="workspace-meta" role="alert">This chat could not be opened. Select it again from your chat history or start a new chat.</p>
          ) : (
            <MessageList messages={currentChat?.messages || []} loading={sendingMessage || loading || !chatReady} />
          )}
        </div>
      )}

      <form className="chat-input-form" onSubmit={handleSubmit}>
        {sendError && (
          <div className="send-error-banner">
            <span>{sendError}</span>
            <button
              type="button"
              className="send-error-dismiss"
              onClick={() => setSendError(null)}
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}
        {!chatId && !sendingMessage && (
          <fieldset className="chat-scope-picker">
            <legend>Search across</legend>
            {[['General', 'All 4 scholars'], ...Object.entries(SCHOLARS)].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={draftScope === value} onClick={() => onScopeChange(value)}>{label}</button>
            ))}
          </fieldset>
        )}
        <div className="input-container workspace-composer">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            aria-label="Ask about our scholars’ work"
            placeholder="Ask about our scholars’ work…"
            className="chat-input"
            rows="1"
            maxLength={6000}
            disabled={composerDisabled}
          />
          <button
            type="submit"
            className="send-button"
            disabled={composerDisabled || !inputValue.trim()}
            aria-label="Send message"
            title="Send message"
          >
            <Send size={20} />
          </button>
        </div>
        {(chatReady || sendingMessage) && (chatId || sendingMessage) && (
          <p className="workspace-meta">
            {scope === 'General' ? <>All 4 scholars <span aria-hidden="true">·</span> {SCHOLAR_NAMES}</> : `Scholar: ${SCHOLARS[scope] || scope.replace(/_/g, ' ')}`}
          </p>
        )}
      </form>
    </div>
  );
};

export default ChatInterface;
