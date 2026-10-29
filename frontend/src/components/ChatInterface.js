import React, { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import { Send } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../utils/api';
import '../styles/ChatInterface.css';

const ChatInterface = ({ 
  chatId,
  selectedDomain, 
  domains, 
  loading, 
  onSendMessage 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [currentChat, setCurrentChat] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState(null);
  const inputRef = useRef(null);
  const chatLoadVersion = useRef(0);

  // Load current chat when chatId changes
  useEffect(() => {
    if (chatId) {
      loadCurrentChat();
    } else {
      setCurrentChat(null);
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
      }
    } catch (error) {
      console.error('Error loading current chat:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputValue.trim() && !sendingMessage) {
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
            timestamp: new Date().toISOString()
          };
          
          setCurrentChat(prev => ({
            ...prev,
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
    if (inputRef.current && !sendingMessage) {
      inputRef.current.focus();
    }
  }, [currentChat, sendingMessage]);

  const getDomainInfo = () => {
    if (selectedDomain === 'General') {
      return 'General Chat';
    }
    if (selectedDomain in domains) {
      return domains[selectedDomain].name || selectedDomain;
    }
    return selectedDomain;
  };

  const getPlaceholderText = () => {
    if (selectedDomain === 'General') {
      return 'Ask me anything...';
    }
    if (selectedDomain in domains) {
      return `Ask about ${getDomainInfo().toLowerCase()}...`;
    }
    return 'Ask me anything...';
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">

      </div>

      <div className="messages-container">
        <MessageList 
          messages={currentChat?.messages || []} 
          loading={sendingMessage || loading} 
        />
      </div>

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
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={getPlaceholderText()}
            className="chat-input"
            rows="1"
            maxLength={6000}
            disabled={sendingMessage}
          />
          <button
            type="submit"
            className="send-button"
            disabled={sendingMessage || !inputValue.trim()}
            title="Send message"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
