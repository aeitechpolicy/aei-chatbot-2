import React, { useState, useEffect, useRef } from 'react';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import FileManager from './components/FileManager';
import SignIn from './components/SignIn';
import UsageReport from './components/UsageReport';
import FeedbackInbox from './components/FeedbackInbox';
import ArticleSearch from './components/ArticleSearch';
import DemoWalkthrough from './components/DemoWalkthrough';
import WhatsNew from './components/WhatsNew';
import LegacyFrame from './components/LegacyFrame';
import LegacyFiles from './components/LegacyFiles';
import LegacySidebar from './components/LegacySidebar';
import { CircleHelp, Sparkles } from 'lucide-react';
import { API_BASE_URL, apiFetch, chatEndpoint, getSession, setSession, signOut } from './utils/api';
import './styles/App.css';
import './styles/Workspace.css';

const demoGuideKey = 'aei-demo-release-guide-seen';

function PrivateApp({ session }) {
  const isDemo = session.user.id === 'demo';
  const [guide, setGuide] = useState(() => {
    if (!isDemo) return null;
    try {
      return window.localStorage.getItem(demoGuideKey) === '1' ? null : 'whats-new';
    } catch {
      return 'whats-new';
    }
  });
  const [currentView, setCurrentView] = useState('chat');
  const [demoVersion, setDemoVersion] = useState(2);
  const legacy = isDemo && demoVersion === 1;
  const chatView = currentView === 'chat' || currentView === 'web';
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatScope, setChatScope] = useState('General');
  const [chatDraft, setChatDraft] = useState({ version: 0, question: '' });
  const [chats, setChats] = useState([]);
  const [domains, setDomains] = useState({});
  const [archiveDomains, setArchiveDomains] = useState({});
  const [archiveError, setArchiveError] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('General');
  const [loading, setLoading] = useState(false);
  const historyRequest = useRef(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia?.('(max-width: 760px)').matches ?? false);

  // Load initial data
  useEffect(() => {
    loadDomains();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadChatHistory();
  }, [legacy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!legacy) return undefined;
    const controller = new AbortController();
    setArchiveError(false);
    apiFetch(chatEndpoint('archive', true), { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Version 1.0 files unavailable');
        return response.json();
      })
      .then(data => { if (!controller.signal.aborted) setArchiveDomains(data.domains); })
      .catch(() => { if (!controller.signal.aborted) setArchiveError(true); });
    return () => controller.abort();
  }, [legacy]);

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
    const request = ++historyRequest.current;
    try {
      const response = await apiFetch(chatEndpoint('history', legacy), {
        headers: getHeaders()
      });
      if (response.ok) {
        const chatsData = await response.json();
        if (request === historyRequest.current) setChats(chatsData);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleNewChat = (question = '') => {
    if (loading) return;
    setCurrentChatId(null);
    if (!legacy) setChatScope('General');
    setChatDraft(draft => ({ version: draft.version + 1, question }));
    setCurrentView(view => !question && view === 'web' ? 'web' : 'chat');
  };

  const handleSelectChat = (chatId) => {
    if (loading) return;
    setCurrentChatId(chatId);
    if (legacy) setChatScope(chats.find(chat => chat.id === chatId)?.domainName || 'General');
    setChatDraft(draft => ({ version: draft.version + 1, question: '' }));
    setCurrentView(view => view === 'web' ? 'web' : 'chat');
  };

  const finishGuide = (next = null) => {
    setGuide(next);
    try {
      window.localStorage.setItem(demoGuideKey, '1');
    } catch {
      // The walkthrough still works when browser storage is unavailable.
    }
  };

  const handleDeleteChat = async (chatId) => {
    if (loading) return;
    try {
      const response = await apiFetch(chatEndpoint(chatId, legacy), {
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

  const handleSendMessage = async (message, mode = 'archive') => {
    if (!message.trim()) return;
  
    let chatId = currentChatId;
    setLoading(true);
    try {
      if (!chatId) {
        const response = await apiFetch(chatEndpoint('new', legacy), {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ domainName: chatScope }),
        });
        if (!response.ok) throw new Error('Failed to create new chat');
        const newChat = await response.json();
        chatId = newChat.id;
        setCurrentChatId(chatId);
        if (chatDraft.question) setChatDraft(draft => ({ ...draft, question: '' }));
      }

      const response = await apiFetch(chatEndpoint(`${chatId}/message`, legacy), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message, mode }),
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

  const selectDemoVersion = version => {
    if (loading || version === demoVersion) return;
    ++historyRequest.current;
    setDemoVersion(version);
    setCurrentView('chat');
    setCurrentChatId(null);
    setChatScope('General');
    setSelectedDomain('General');
    setChatDraft(draft => ({ version: draft.version + 1, question: '' }));
    setChats([]);
  };

  const versionPicker = isDemo && <nav className="demo-version-nav" aria-label="Chatbot version">
        <button type="button" aria-pressed={legacy} disabled={loading} onClick={() => selectDemoVersion(1)}>
          <strong>Version 1.0</strong><span>Pre-September 2026</span>
        </button>
        <button type="button" aria-pressed={!legacy} disabled={loading} onClick={() => selectDemoVersion(2)}>
          <strong>Version 2.0</strong><span>November 2026</span>
        </button>
      </nav>;

  const guideDialog = <>
    {guide === 'whats-new' && <WhatsNew onClose={() => finishGuide()}
      onStartTour={() => { if (legacy) selectDemoVersion(2); finishGuide('tour'); }} />}
    {guide === 'tour' && <DemoWalkthrough busy={loading} onClose={() => finishGuide()}
      onTryQuestion={question => { finishGuide(); handleNewChat(question); }} />}
  </>;

  const sidebarActions = {
    chats, currentChatId, collapsed: sidebarCollapsed,
    onViewChange: handleViewChange, onNewChat: () => handleNewChat(),
    onSelectChat: handleSelectChat, onDeleteChat: handleDeleteChat, onCollapse: handleSidebarCollapse,
  };

  const chat = <ChatInterface key={chatDraft.version} active={chatView} web={currentView === 'web'}
    legacy={legacy} chatId={currentChatId} initialQuestion={chatDraft.question}
    draftScope={chatScope} onScopeChange={setChatScope} loading={loading} onSendMessage={handleSendMessage} />;

  if (legacy) return (
    <div className="app legacy-workspace">
      {versionPicker}
      <div className="legacy-archive-note">
        <p>Version 1.0 uses the files saved on August 26, 2026. The newest recorded publication is July 15, 2026. For the current collection, switch to Version 2.0.</p>
        <div className="pilot-header-actions">
          <button type="button" onClick={() => setGuide('whats-new')}>What’s new</button>
          <button type="button" onClick={() => { signOut().catch(() => {}); }}>Sign out</button>
        </div>
      </div>
      {archiveError && <p role="alert">The Version 1.0 files could not be loaded.</p>}
      <LegacyFrame>
        <div className="app">
          <div className="app-header">
            <div className="header-content">
              <a className="logo-link" href="https://www.aei.org/" target="_blank" rel="noopener noreferrer">
                <img src="/aeilogo.jpg" alt="AEI Logo" className="logo" />
              </a>
              <h1>AEI Chatbot</h1><p>Chat with your Scholars!</p>
            </div>
          </div>
          <div className={`app-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <LegacySidebar {...sidebarActions} currentView={currentView} domains={archiveDomains}
              selectedDomain={currentView === 'files' ? selectedDomain : chatScope}
              onDomainChange={domain => {
                if (currentView === 'files') return handleDomainChange(domain);
                if (loading || domain === chatScope) return;
                handleNewChat();
                setChatScope(domain);
              }} />
            <div className="legacy-chat-panel" hidden={!chatView}>{chat}</div>
            {currentView === 'files' && <LegacyFiles domains={archiveDomains} domain={selectedDomain} onDomainChange={handleDomainChange} />}
          </div>
        </div>
      </LegacyFrame>
      {guideDialog}
    </div>
  );

  return (
    <div className="app article-workspace">
      {versionPicker}
      <div className="app-header">
        <div className="header-content">
          <div className="workspace-brand">
            <img src="/aeilogo.jpg" alt="AEI Logo" className="logo" />
            <h1>AEI Chatbot</h1>
          </div>
          <nav className="article-mode-switch" aria-label="Article mode">
            <button type="button" aria-pressed={currentView === 'chat'} onClick={() => setCurrentView('chat')}>Article Chat</button>
            <button type="button" aria-pressed={currentView === 'research'} onClick={() => setCurrentView('research')}>AEI Article Search</button>
            <button type="button" aria-pressed={currentView === 'web'} onClick={() => setCurrentView('web')}>AEI + Web</button>
          </nav>
          <div className="pilot-header-actions"><span>{session.user.label}</span>
            {isDemo && <>
              <button className="walkthrough-trigger" type="button" onClick={() => setGuide('whats-new')}>
                <Sparkles size={16} aria-hidden="true" /> What’s new
              </button>
              <button type="button" onClick={() => setGuide('tour')}>
                <CircleHelp size={16} aria-hidden="true" className="walkthrough-help-icon" /> How to use
              </button>
            </>}
            {!isDemo && <button onClick={() => setCurrentView('feedback')}>Feedback inbox</button>}
            {!isDemo && <button onClick={() => setCurrentView('usage')}>Usage and costs</button>}
            <button onClick={() => { signOut().catch(() => {}); }}>Sign out</button>
          </div>
        </div>
      </div>
      
      <div className={`app-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar
          {...sidebarActions}
          currentView={currentView === 'web' ? 'chat' : currentView}
          domains={domains}
          selectedDomain={selectedDomain}
          showFileManager={!isDemo}
          chatBusy={loading}
          onDomainChange={handleDomainChange}
          onFileUpload={handleFileUpload}
          onDomainsUpdate={loadDomains}
        />
        
        <div className="workspace-panel" hidden={!chatView}>
          {chat}
        </div>
        <div className="workspace-panel" hidden={currentView !== 'research'}>
          <ArticleSearch showFileCounts={!isDemo} />
        </div>
        {currentView === 'usage' && <UsageReport />}
        {!isDemo && currentView === 'feedback' && <FeedbackInbox />}
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
      {guideDialog}
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
