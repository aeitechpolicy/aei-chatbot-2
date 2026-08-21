import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import FileManager from './components/FileManager';
import UserManager from './utils/userManager';
import './styles/App.css';

function App() {
  const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'files'
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [domains, setDomains] = useState({});
  const [selectedDomain, setSelectedDomain] = useState('General');
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userManager] = useState(() => new UserManager());
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Load initial data
  useEffect(() => {
    loadDomains();
    loadChatHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': userManager.getUserId()
  });


  const loadDomains = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/domains`);
      if (response.ok) {
        const domainsData = await response.json();
        setDomains(domainsData);
      }
    } catch (error) {
      console.error('Error loading domains:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/history`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const chatsData = await response.json();
        setChats(chatsData);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleNewChat = async (domain = null) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/new`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ domainName: domain || selectedDomain }),
      });

      if (response.ok) {
        const newChat = await response.json();
        setCurrentChatId(newChat.id);
        setSelectedDomain(newChat.domainName);
        setCurrentView('chat');
        await loadChatHistory(); // Refresh chat list
        userManager.updateLastActive();
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  const handleSelectChat = async (chatId) => {
    setCurrentChatId(chatId);
    setCurrentView('chat');
    
    // Load chat details to set domain
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/${chatId}`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const chat = await response.json();
        setSelectedDomain(chat.domainName);
        userManager.updateLastActive();
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/${chatId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (response.ok) {
        // If we're deleting the current chat, clear it
        if (currentChatId === chatId) {
          setCurrentChatId(null);
        }
        await loadChatHistory();
        userManager.updateLastActive();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;
  
    let chatId = currentChatId;
  
    // Create new chat if none exists
    if (!chatId) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/new`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ domainName: selectedDomain }),
        });
  
        if (response.ok) {
          const newChat = await response.json();
          chatId = newChat.id;
          setCurrentChatId(newChat.id);
          setSelectedDomain(newChat.domainName);
          setCurrentView('chat');
          userManager.updateLastActive();
        } else {
          throw new Error('Failed to create new chat');
        }
      } catch (error) {
        console.error('Error creating new chat:', error);
        return;
      }
    }
  
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/${chatId}/message`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message }),
      });
  
      if (response.ok) {
        const data = await response.json();

        // Always reload chat history to update sidebar
        await loadChatHistory();

        return data;
      } else {
        const errorData = await response.json().catch(() => ({}));
        const sendError = new Error(errorData.error || 'Failed to send message');
        sendError.code = errorData.code;
        throw sendError;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files, domain) => {
    const formData = new FormData();
    
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/files/upload/${domain}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await loadDomains(); // Reload domains after upload
        return true;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      return false;
    }
  };

  const handleDomainChange = (domain) => {
    setSelectedDomain(domain);
    // Don't clear current chat when changing domains
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  const handleSidebarCollapse = (collapsed) => {
    setSidebarCollapsed(collapsed);
  };

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-content">
          <a className='logo-link' target="_blank" rel="noopener noreferrer" href='https://www.aei.org/'>
            <img src="/aeilogo.jpg" alt="AEI Logo" className="logo" />
          </a>
          <h1>AEI Chatbot</h1>
          <p>Chat with your Scholars!</p>
        </div>
      </div>
      
      <div className={`app-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar
          currentView={currentView}
          domains={domains}
          selectedDomain={selectedDomain}
          chats={chats}
          currentChatId={currentChatId}
          collapsed={sidebarCollapsed}
          onViewChange={handleViewChange}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onDomainChange={handleDomainChange}
          onFileUpload={handleFileUpload}
          onCollapse={handleSidebarCollapse}
          onDomainsUpdate={loadDomains}
        />
        
        {currentView === 'chat' ? (
          <ChatInterface
            chatId={currentChatId}
            selectedDomain={selectedDomain}
            domains={domains}
            loading={loading}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <FileManager
            domains={domains}
            selectedDomain={selectedDomain}
            onDomainsUpdate={loadDomains}
            onDomainChange={handleDomainChange}
            API_BASE_URL={API_BASE_URL}
          />
        )}
      </div>
    </div>
  );
}

export default App;
