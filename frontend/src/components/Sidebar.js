import React, { useState, useRef } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Folder,
  ChevronDown,
  ChevronRight,
  ArrowLeftToLine,
  ArrowRightFromLine,
  Trash2,
  MoreHorizontal,
  Search
} from 'lucide-react';
import '../styles/Sidebar.css';

const Sidebar = ({ 
  currentView,
  domains, 
  selectedDomain,
  chats,
  currentChatId,
  collapsed,
  showFileManager = true,
  onViewChange,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onDomainChange,
  onFileUpload,
  onCollapse,
  onDomainsUpdate
}) => {
  const [expandedSections, setExpandedSections] = useState({
    chats: true,
    domains: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showChatOptions, setShowChatOptions] = useState(null);
  const optionsRef = useRef(null);

  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.domainName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentChats = filteredChats.slice(0, 20);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleChatOptions = (chatId, event) => {
    event.stopPropagation();
    setShowChatOptions(showChatOptions === chatId ? null : chatId);
  };

  const formatChatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleDeleteChat = async (chatId, event) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat?')) {
      await onDeleteChat(chatId);
      setShowChatOptions(null);
    }
  };

  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <div className="sidebar-header">
          <button 
            className="sidebar-toggle"
            onClick={() => onCollapse(false)}
            title="Expand sidebar"
          >
            <ArrowRightFromLine size={18} />
          </button>
        </div>
        <div className="sidebar-collapsed-actions">
          <button 
            className={`sidebar-action ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => onViewChange('chat')}
            title="Chat"
          >
            <MessageSquare size={20} />
          </button>
          <button 
            className="sidebar-action"
            onClick={() => onNewChat()}
            title="New Chat"
          >
            <Plus size={20} />
          </button>
          {showFileManager && <button
            className={`sidebar-action ${currentView === 'files' ? 'active' : ''}`}
            onClick={() => onViewChange('files')}
            title="File Manager"
          >
            <Folder size={20} />
          </button>}
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar expanded">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <h3>Menu</h3>
        </div>
        <button 
          className="sidebar-toggle"
          onClick={() => onCollapse(true)}
          title="Collapse sidebar"
        >
          <ArrowLeftToLine size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        {/* Main Actions */}
        <div className="sidebar-actions">
          <button 
            className="action-button new-chat"
            onClick={() => onNewChat()}
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
          
          <div className="view-tabs">
            <button 
              className={`view-tab ${currentView === 'chat' ? 'active' : ''}`}
              onClick={() => onViewChange('chat')}
            >
              <MessageSquare size={16} />
              <span>Chats</span>
            </button>
            {showFileManager && <button
              className={`view-tab ${currentView === 'files' ? 'active' : ''}`}
              onClick={() => onViewChange('files')}
            >
              <Folder size={16} />
              <span>Files</span>
            </button>}
          </div>
        </div>

        {/* Search */}
        {currentView === 'chat' && (
          <div className="search-section">
            <div className="search-input-container">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        )}

        {/* Chat History */}
        {currentView === 'chat' && (
          <div className="section">
            <button 
              className="section-header"
              onClick={() => toggleSection('chats')}
            >
              {expandedSections.chats ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Recent Chats ({recentChats.length})</span>
            </button>

            {expandedSections.chats && (
              <div className="section-content">
                {recentChats.length === 0 ? (
                  <div className="empty-state">
                    <p>No chats found</p>
                    <button 
                      className="empty-action"
                      onClick={() => onNewChat()}
                    >
                      Start your first chat
                    </button>
                  </div>
                ) : (
                  <div className="chat-list">
                    {recentChats.map((chat) => (
                      <div 
                        key={chat.id}
                        className={`chat-item ${currentChatId === chat.id ? 'active' : ''}`}
                        onClick={() => onSelectChat(chat.id)}
                      >
                        <div className="chat-content">
                          <div className="chat-title">{chat.title}</div>
                          <div className="chat-meta">
                            <span className="chat-domain">{chat.domainName}</span>
                            <span className="chat-date">{formatChatDate(chat.updatedAt)}</span>
                          </div>
                        </div>
                        <div className="chat-actions">
                          <button
                            className="chat-options"
                            onClick={(e) => handleChatOptions(chat.id, e)}
                            title="More options"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {showChatOptions === chat.id && (
                            <div className="chat-options-menu" ref={optionsRef}>
                              <button
                                onClick={(e) => handleDeleteChat(chat.id, e)}
                                className="option-item delete"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Domain Selection for File View */}
        {currentView === 'files' && (
          <div className="section">
            <div className="section-header">
              <span>Available Scholars</span>
            </div>
            <div className="section-content">
              <div className="domain-list">
                {Object.keys(domains).length === 0 ? (
                  <div className="empty-state">
                    <p>No scholars found</p>
                    <p className="empty-help">Create scholar folders in the file manager</p>
                  </div>
                ) : (
                  Object.entries(domains).map(([domainName, domainInfo]) => (
                    <div 
                      key={domainName}
                      className={`domain-item ${selectedDomain === domainName ? 'active' : ''}`}
                      onClick={() => onDomainChange(domainName)}
                    >
                      <div className="domain-content">
                        <div className="domain-name">{domainInfo.name || domainName}</div>
                        <div className="domain-meta">
                          {domainInfo.file_count} files
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Domain Selector for Chat View */}
        {currentView === 'chat' && (
          <div className="section">
            <button 
              className="section-header"
              onClick={() => toggleSection('domains')}
            >
              {expandedSections.domains ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Scholars</span>
            </button>

            {expandedSections.domains && (
              <div className="section-content">
                <div className="domain-selector">
                  <div className="domain-option general" onClick={() => onDomainChange('General')}>
                    <div className={`domain-radio ${selectedDomain === 'General' ? 'active' : ''}`}>
                      <div className="radio-dot"></div>
                    </div>
                    <span>General Chat</span>
                  </div>
                  
                  {Object.entries(domains).map(([domainName, domainInfo]) => (
                    <div 
                      key={domainName}
                      className="domain-option"
                      onClick={() => onDomainChange(domainName)}
                    >
                      <div className={`domain-radio ${selectedDomain === domainName ? 'active' : ''}`}>
                        <div className="radio-dot"></div>
                      </div>
                      <div className="domain-info">
                        <span className="domain-name">{domainInfo.name || domainName}</span>
                        <span className="file-count">{domainInfo.file_count} files</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
