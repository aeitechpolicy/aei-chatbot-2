import React, { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import LegacyMessageList from './LegacyMessageList';
import RelatedNews from './RelatedNews';
import { Send } from 'lucide-react';
import { API_BASE_URL, apiFetch, chatEndpoint } from '../utils/api';
import { SCHOLARS, SCHOLAR_NAMES } from '../utils/scholars';
import '../styles/ChatInterface.css';

const ChatInterface = ({ 
  active,
  web = false,
  legacy = false,
  chatId,
  initialQuestion = '',
  draftScope,
  onScopeChange,
  loading, 
  onSendMessage 
}) => {
  const [inputValue, setInputValue] = useState(initialQuestion);
  const [currentChat, setCurrentChat] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [chatLoadError, setChatLoadError] = useState(false);
  const [compare, setCompare] = useState(false);
  const [webAvailable, setWebAvailable] = useState(null);
  const inputRef = useRef(null);
  const chatLoadVersion = useRef(0);

  // Load current chat when chatId changes
  useEffect(() => {
    if (chatId) {
      loadCurrentChat();
    } else {
      ++chatLoadVersion.current;
      setCurrentChat(null);
      setInputValue(initialQuestion);
      setSendError(null);
      setChatLoadError(false);
    }
  }, [chatId, initialQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!web) return;
    let active = true;
    setWebAvailable(null);
    apiFetch(`${API_BASE_URL}/api/chat/capabilities`)
      .then(async response => response.ok && (await response.json()).webSearch === true)
      .then(available => { if (active) setWebAvailable(available); })
      .catch(() => { if (active) setWebAvailable(false); });
    return () => { active = false; };
  }, [web]);

  const loadCurrentChat = async () => {
    if (!chatId) return;
    const version = ++chatLoadVersion.current;
    
    try {
      const response = await apiFetch(chatEndpoint(chatId, legacy), {
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
        const result = await onSendMessage(messageToSend, web ? 'web' : !legacy && compare && scope === 'General' ? 'compare' : 'archive');
        
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
            searchMode: result.searchMode,
            comparison: result.comparison,
            followUps: result.followUps,
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
  };

  const fillFollowUp = question => {
    setInputValue(question);
    setSendError(null);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  }, [inputValue, active]);

  useEffect(() => {
    if (active && inputRef.current && !sendingMessage && !loading) {
      inputRef.current.focus();
    }
  }, [active, currentChat, sendingMessage, loading]);

  const scope = (chatId && currentChat?.domainName) || draftScope;
  const chatReady = !chatId || currentChat?.id === chatId;
  const composerDisabled = sendingMessage || loading || !chatReady || (web && !webAvailable);
  const empty = chatReady && !currentChat?.messages?.length && !sendingMessage && !loading;
  const home = empty && !chatId && !web && !legacy;
  const Messages = legacy ? LegacyMessageList : MessageList;

  return (
    <div className={`chat-interface ${empty && !legacy ? 'workspace-start' : ''} ${home ? 'article-chat-home' : ''}`}>
      {legacy && <div className="chat-header" />}
      {empty && !legacy ? (
        <div className="workspace-intro">
          <p className="workspace-kicker">{web ? 'Experimental' : 'AEI Chatbot'}</p>
          <h2>{web ? 'Research with AEI and the web' : 'What policy question are you researching?'}</h2>
          <p>{web ? 'Find relevant scholarship and additional context from the web.' : 'Ask about work in the AEI Scholar Library.'}</p>
        </div>
      ) : (
        <div className="messages-container">
          {chatLoadError && !chatReady ? (
            <p className="workspace-meta" role="alert">This chat could not be opened. Select it again from your chat history or start a new chat.</p>
          ) : (
            <Messages messages={currentChat?.messages || []} loading={sendingMessage || loading || !chatReady} title={currentChat?.title} chatId={currentChat?.id} onFollowUp={composerDisabled ? undefined : fillFollowUp} />
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
        {!legacy && !chatId && !sendingMessage && (
          <fieldset className="chat-scope-picker">
            <legend>Search across</legend>
            {[['General', 'All 4 scholars'], ...Object.entries(SCHOLARS)].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={draftScope === value} onClick={() => onScopeChange(value)}>{label}</button>
            ))}
          </fieldset>
        )}
        {!legacy && <div className="chat-research-options">
          {web ? <p className="workspace-meta" role="status">
            {webAvailable === null ? 'Checking web search availability…' : webAvailable
              ? 'Your question is used to search the web.'
              : 'Web search is currently unavailable.'}
          </p> : scope === 'General' && <button type="button" className="compare-toggle" disabled={composerDisabled}
            aria-pressed={compare} onClick={() => setCompare(value => !value)}>Compare scholars</button>}
        </div>}
        <div className={legacy ? 'input-container' : 'input-container workspace-composer'}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            aria-label="Ask about our scholars’ work"
            placeholder={legacy
              ? (scope === 'General' ? 'Ask me anything...' : `Ask about ${(SCHOLARS[scope] || scope).toLowerCase()}...`)
              : web ? 'Ask a question for AEI and web research…' : compare && scope === 'General' ? 'Ask one question for all four scholars…' : 'Ask about our scholars’ work…'}
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
        {!legacy && (chatReady || sendingMessage) && (chatId || sendingMessage) && (
          <p className="workspace-meta">
            {scope === 'General' ? <>All 4 scholars <span aria-hidden="true">·</span> {SCHOLAR_NAMES}</> : `Scholar: ${SCHOLARS[scope] || scope.replace(/_/g, ' ')}`}
          </p>
        )}
      </form>
      {home && active && <RelatedNews />}
    </div>
  );
};

export default ChatInterface;
