import { apiFetch } from '../utils/api';
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Upload, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  FileText,
  Folder,
  Search,
} from 'lucide-react';
import '../styles/FileManager.css';

const FileManager = ({ 
  domains, 
  selectedDomain, 
  onDomainsUpdate, 
  onDomainChange,
  API_BASE_URL 
}) => {
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');
  const [showNewDomainForm, setShowNewDomainForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    if (selectedDomain && selectedDomain !== 'General') {
      loadDomainFiles();
    }
  }, [selectedDomain]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDomainFiles = async () => {
    if (!selectedDomain || selectedDomain === 'General') return;
    
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/files/content/${selectedDomain}`);
      if (response.ok) {
        const filesData = await response.json();
        setFiles(filesData);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDomain = async (e) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/files/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newDomainName.trim(),
          description: newDomainDesc.trim() 
        }),
      });

      if (response.ok) {
        setNewDomainName('');
        setNewDomainDesc('');
        setShowNewDomainForm(false);
        await onDomainsUpdate();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create scholar folder');
      }
    } catch (error) {
      console.error('Error creating domain:', error);
      alert('Failed to create scholar folder');
    }
  };

  const handleDeleteDomain = async (domainName) => {
    if (!window.confirm(`Are you sure you want to delete "${domainName}" and all its files?`)) {
      return;
    }

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/files/domains/${domainName}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await onDomainsUpdate();
        if (selectedDomain === domainName) {
          onDomainChange('General');
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete scholar folder');
      }
    } catch (error) {
      console.error('Error deleting domain:', error);
      alert('Failed to delete scholar folder');
    }
  };

  const handleFileUpload = async (event) => {
    const uploadFiles = event.target.files;
    if (!uploadFiles || uploadFiles.length === 0 || !selectedDomain) return;

    setUploadingFiles(true);
    const formData = new FormData();
    
    Array.from(uploadFiles).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/files/upload/${selectedDomain}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await loadDomainFiles();
        await onDomainsUpdate();
        event.target.value = ''; // Clear input
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to upload files');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleEditFile = async (filename) => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/files/content/${selectedDomain}/${filename}`);
      if (response.ok) {
        const data = await response.json();
        setFileContent(data.content);
        setEditingFile(filename);
      }
    } catch (error) {
      console.error('Error loading file content:', error);
      alert('Failed to load file content');
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/files/content/${selectedDomain}/${editingFile}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent }),
      });

      if (response.ok) {
        setEditingFile(null);
        setFileContent('');
        await loadDomainFiles();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save file');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert('Failed to save file');
    }
  };

  const handleDeleteFile = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/files/content/${selectedDomain}/${filename}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadDomainFiles();
        await onDomainsUpdate();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const filteredFiles = Object.entries(files).filter(([filename]) =>
    filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentDomainInfo = domains[selectedDomain];

  return (
    <div className="file-manager">
      <div className="file-manager-header">
        <h2>File Manager</h2>
        <p>Manage your knowledge base files and scholar folders</p>
      </div>

      <div className="file-manager-content">
        {/* Domain Management Section */}
        <div className="section">
          <div className="section-header">
            <h3>Scholar Folders</h3>
            <button 
              className="action-button primary"
              onClick={() => setShowNewDomainForm(true)}
            >
              <Plus size={16} />
              New Scholar
            </button>
          </div>

          {showNewDomainForm && (
            <div className="new-domain-form">
              <form onSubmit={handleCreateDomain}>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Scholar name (e.g., Shane_Tews)"
                    value={newDomainName}
                    onChange={(e) => setNewDomainName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newDomainDesc}
                    onChange={(e) => setNewDomainDesc(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="action-button primary">
                    <Save size={16} />
                    Create
                  </button>
                  <button 
                    type="button" 
                    className="action-button secondary"
                    onClick={() => {
                      setShowNewDomainForm(false);
                      setNewDomainName('');
                      setNewDomainDesc('');
                    }}
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="domains-grid">
            {Object.entries(domains).map(([domainName, domainInfo]) => (
              <div 
                key={domainName}
                className={`domain-card ${selectedDomain === domainName ? 'selected' : ''}`}
                onClick={() => onDomainChange(domainName)}
              >
                <div className="domain-icon">
                  <Folder size={24} />
                </div>
                <div className="domain-info">
                  <h4>{domainInfo.name || domainName}</h4>
                  <p>{domainInfo.file_count} files</p>
                  <small>{domainInfo.description}</small>
                </div>
                <div className="domain-actions">
                  <button
                    className="action-button danger small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDomain(domainName);
                    }}
                    title="Delete scholar folder"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* File Management Section */}
        {selectedDomain && selectedDomain !== 'General' && currentDomainInfo && (
          <div className="section">
            <div className="section-header">
              <h3>{currentDomainInfo.name || selectedDomain} Files</h3>
              <div className="header-actions">
                <label className="action-button primary upload-button">
                  <Upload size={16} />
                  {uploadingFiles ? 'Uploading...' : 'Upload Files'}
                  <input
                    type="file"
                    multiple
                    accept=".txt"
                    onChange={handleFileUpload}
                    disabled={uploadingFiles}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* Search */}
            <div className="search-container">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {loading ? (
              <div className="loading-state">
                <p>Loading files...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <h4>No files found</h4>
                <p>Upload .txt files to get started</p>
              </div>
            ) : (
              <div className="files-grid">
                {filteredFiles.map(([filename, content]) => (
                  <div key={filename} className="file-card">
                    <div className="file-icon">
                      <FileText size={24} />
                    </div>
                    <div className="file-info">
                      <h4>{filename}</h4>
                      <p>{content.length} characters</p>
                    </div>
                    <div className="file-actions">
                      <button
                        className="action-button secondary small"
                        onClick={() => handleEditFile(filename)}
                        title="Edit file"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className="action-button danger small"
                        onClick={() => handleDeleteFile(filename)}
                        title="Delete file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Editor Modal */}
      {editingFile && (
        <div className="modal-overlay" onClick={() => setEditingFile(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editing: {editingFile}</h3>
              <button 
                className="modal-close"
                onClick={() => setEditingFile(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="file-editor"
                placeholder="Enter file content..."
              />
            </div>
            <div className="modal-footer">
              <button 
                className="action-button primary"
                onClick={handleSaveFile}
              >
                <Save size={16} />
                Save Changes
              </button>
              <button 
                className="action-button secondary"
                onClick={() => setEditingFile(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;
