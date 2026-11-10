import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import FileManager from './components/FileManager';
import SignIn from './components/SignIn';
import UsageReport from './components/UsageReport';
import ArticleSearch from './components/ArticleSearch';
import { API_BASE_URL, apiFetch, getSession, setSession, signOut } from './utils/api';
import './styles/App.css';
import './styles/Workspace.css';

function PrivateApp({ session }) {
  const isDemo = session.user.id === 'demo';
  const [currentView, setCurrentView] = useState('chat');
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatScope, setChatScope] = useState('General');
  const [chatVersion, setChatVersion] = useState(0);
  const [chats, setChats] = useState([]);
  const [domains, setDomains] = useState({});
  const [selectedDomain, setSelectedDomain] = useState('General');
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia?.('(max-width: 760px)').matches ?? false);

  // Load initial data
  useEffect(() => {
    loadDomains();
    loadChatHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getHeaders = () => ({
    'Content-Type': 'application/json'
  });


  const loadDomains = async () => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/files/domains`);
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
      const response = await apiFetch(`${API_BASE_URL}/api/chat/history`, {
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

  const handleNewChat = () => {
    if (loading) return;
    setCurrentChatId(null);
    setChatScope('General');
    setChatVersion(version => version + 1);
    setCurrentView('chat');
  };

  const handleSelectChat = (chatId) => {
    if (loading) return;
    setCurrentChatId(chatId);
    setChatVersion(version => version + 1);
    setCurrentView('chat');
  };

  const handleDeleteChat = async (chatId) => {
    if (loading) return;
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/chat/${chatId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (response.ok) {
        setCurrentChatId(activeId => activeId === chatId ? null : activeId);
        await loadChatHistory();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;
  
    let chatId = currentChatId;
    setLoading(true);
    try {
      if (!chatId) {
        const response = await apiFetch(`${API_BASE_URL}/api/chat/new`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ domainName: chatScope }),
        });
        if (!response.ok) throw new Error('Failed to create new chat');
        const newChat = await response.json();
        chatId = newChat.id;
        setCurrentChatId(chatId);
      }

      const response = await apiFetch(`${API_BASE_URL}/api/chat/${chatId}/message`, {
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
      const response = await apiFetch(`${API_BASE_URL}/api/files/upload/${domain}`, {
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
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  const handleSidebarCollapse = (collapsed) => {
    setSidebarCollapsed(collapsed);
  };

  return (
    <div className="app article-workspace">
      <div className="app-header">
        <div className="header-content">
          <div className="workspace-brand">
            <img src="/aeilogo.jpg" alt="AEI Logo" className="logo" />
            <h1>AEI Chatbot</h1>
          </div>
          <nav className="article-mode-switch" aria-label="Article mode">
            <button type="button" aria-pressed={currentView === 'chat'} onClick={() => setCurrentView('chat')}>Article Chat</button>
            <button type="button" aria-pressed={currentView === 'research'} onClick={() => setCurrentView('research')}>Article Search</button>
          </nav>
          <div className="pilot-header-actions"><span>{session.user.label}</span>
            {!isDemo && <button onClick={() => setCurrentView('usage')}>Usage and costs</button>}
            <button onClick={() => { signOut().catch(() => {}); }}>Sign out</button>
          </div>
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
          showFileManager={!isDemo}
          chatBusy={loading}
          onViewChange={handleViewChange}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onDomainChange={handleDomainChange}
          onFileUpload={handleFileUpload}
          onCollapse={handleSidebarCollapse}
          onDomainsUpdate={loadDomains}
        />
        
        <div className="workspace-panel" hidden={currentView !== 'chat'}>
          <ChatInterface
            key={chatVersion}
            active={currentView === 'chat'}
            chatId={currentChatId}
            draftScope={chatScope}
            onScopeChange={setChatScope}
            loading={loading}
            onSendMessage={handleSendMessage}
          />
        </div>
        <div className="workspace-panel" hidden={currentView !== 'research'}>
          <ArticleSearch showFileCounts={!isDemo} />
        </div>
        {currentView === 'usage' && <UsageReport />}
        {currentView === 'files' && (
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

function App() {
  const [session, updateSession] = useState(getSession);
  const [checking, setChecking] = useState(Boolean(getSession()));
  const [error, setError] = useState('');
  useEffect(() => {
    const changed = () => { updateSession(getSession()); setError(''); };
    window.addEventListener('aei-session-changed', changed);
    if (getSession()) {
      apiFetch(`${API_BASE_URL}/api/auth/session`).then(response => {
        if (!response.ok) setSession(null);
      }).catch(() => { setSession(null); setError('The chatbot could not be reached. Please try again.'); })
        .finally(() => setChecking(false));
    }
    return () => window.removeEventListener('aei-session-changed', changed);
  }, []);
  if (checking) return <main className="sign-in-page"><p role="status">Checking your session…</p></main>;
  if (!session) return <>{error && <p role="alert">{error}</p>}<SignIn /></>;
  return <PrivateApp key={session.user.id} session={session} />;
}

export default App;
