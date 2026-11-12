import React, { useEffect, useState } from 'react';
import { Eye, FileText, Folder, Search, X } from 'lucide-react';
import { apiFetch, chatEndpoint } from '../utils/api';

export default function LegacyFiles({ domains, domain, onDomainChange }) {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setFiles([]);
    setSelected('');
    setContent('');
    setQuery('');
    setError('');
    setLoading(Boolean(domains[domain]));
    if (domains[domain]) {
      apiFetch(chatEndpoint(`archive/${encodeURIComponent(domain)}`, true), { signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error('Archive files unavailable');
          return response.json();
        })
        .then(data => { if (!controller.signal.aborted) setFiles(data.files); })
        .catch(() => { if (!controller.signal.aborted) setError('The archive files could not be opened.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [domain, domains]);

  useEffect(() => {
    if (!selected) return undefined;
    const controller = new AbortController();
    setContent('');
    apiFetch(chatEndpoint(`archive/${encodeURIComponent(domain)}/${encodeURIComponent(selected)}`, true), { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Archive file unavailable');
        return response.json();
      })
      .then(data => { if (!controller.signal.aborted) setContent(data.content); })
      .catch(() => { if (!controller.signal.aborted) setError('The archive file could not be opened.'); });
    return () => controller.abort();
  }, [domain, selected]);

  const visibleFiles = files.filter(file => file.toLowerCase().includes(query.toLowerCase()));

  return <div className="file-manager">
    <div className="file-manager-header"><h2>File Manager</h2><p>Browse the saved Version 1.0 files.</p></div>
    <div className="file-manager-content">
      <div className="section">
        <div className="section-header"><h3>Scholar Folders</h3></div>
        <div className="domains-grid">
          {Object.entries(domains).map(([key, info]) => <button className={`domain-card ${domain === key ? 'selected' : ''}`}
            key={key} type="button" onClick={() => onDomainChange(key)}>
            <div className="domain-icon"><Folder size={24} /></div>
            <div className="domain-info"><h4>{info.name}</h4><p>{info.file_count} files</p></div>
          </button>)}
        </div>
      </div>
      {domains[domain] && <div className="section">
        <div className="section-header"><h3>{domains[domain].name} Files</h3></div>
        <div className="search-container">
          <Search size={16} />
          <input className="search-input" aria-label="Search archive files" placeholder="Search files..." value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        {loading ? <div className="loading-state" role="status">Loading files...</div> : visibleFiles.length ? <div className="files-grid">
          {visibleFiles.map(file => <div className="file-card" key={file}>
            <div className="file-icon"><FileText size={24} /></div>
            <div className="file-info"><h4>{file}</h4></div>
            <div className="file-actions">
              <button className="action-button secondary small" type="button" aria-label={`Open ${file}`} onClick={() => { setError(''); setSelected(file); }}>
                <Eye size={14} />
              </button>
            </div>
          </div>)}
        </div> : !error && <div className="empty-state"><FileText size={48} /><h4>No files found</h4></div>}
      </div>}
      {!selected && error && <p role="alert">{error}</p>}
    </div>
    {selected && <div className="modal-overlay">
      <div className="modal-content" role="dialog" aria-label={selected}
        onKeyDown={event => { if (event.key === 'Escape') setSelected(''); }}>
        <div className="modal-header"><h3>{selected}</h3>
          <button className="modal-close" aria-label="Close file" type="button" onClick={() => setSelected('')}><X size={20} /></button>
        </div>
        <div className="modal-body">{error ? <p role="alert">{error}</p> : content ?
          <textarea className="file-editor" aria-label="Saved file text" readOnly value={content} /> : <p role="status">Loading file...</p>}</div>
      </div>
    </div>}
  </div>;
}
