import React, { useState } from 'react';
import ResearchDialog from './ResearchDialog';
import { API_BASE_URL, apiFetch, chatEndpoint } from '../utils/api';
import { sourceLink } from '../utils/sources';

const REASONS = ['Incorrect information', 'Missing context', 'Citation issue', 'Other'];
const SOURCE_REASONS = ['Incorrect title, byline or date', 'Broken or incorrect link', 'Incorrect passage', 'Irrelevant result', 'Other'];

export default function FeedbackDialog({ chatId, messageIndex, answer, source, sent, onSent, onClose }) {
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!category || !detail.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const url = chatId ? chatEndpoint(`${chatId}/feedback`) : `${API_BASE_URL}/api/research/feedback`;
      const target = chatId ? { messageIndex, ...(source && { sourceId: source.id }) } : { sourceRef: source.sourceRef };
      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, category, detail })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'The report could not be sent. Try again.');
      }
      onSent();
    } catch (problem) {
      setError(problem.message || 'The report could not be sent. Try again.');
    } finally {
      setSending(false);
    }
  }

  return <ResearchDialog title="Send to the team" onClose={onClose}>
    {sent ? <div className="feedback-confirmation">
      <p role="status">Your report was sent to the staff inbox.</p>
      <button type="button" className="research-primary" onClick={onClose}>Done</button>
    </div> : <form className="feedback-form" onSubmit={submit}>
      <p>Staff will see the selected {source ? 'source' : 'answer'}, your account label, and your explanation.</p>
      {source && <p className="feedback-source-title"><strong>{source.title}</strong></p>}
      <label>What went wrong?
        <select value={category} onChange={event => setCategory(event.target.value)} required disabled={sending}>
          <option value="">Choose a reason</option>
          {(source ? SOURCE_REASONS : REASONS).map(reason => <option key={reason}>{reason}</option>)}
        </select>
      </label>
      <label>What should the team know?
        <textarea rows="4" maxLength={2000} value={detail} onChange={event => setDetail(event.target.value)} required disabled={sending}
          placeholder={source ? 'Describe the issue and include the correct information if you have it.' : 'Explain what happened or what you expected to find.'} />
      </label>
      {source ? <details className="feedback-answer">
        <summary>Preview the source you’re sharing</summary>
        <p>{[source.author || source.publisher, source.eventDate || source.date].filter(Boolean).join(' · ')}</p>
        {sourceLink(source) && <a href={sourceLink(source)} target="_blank" rel="noopener noreferrer">Open reported source</a>}
        {chatId && source.excerpt && <blockquote>{source.excerpt}</blockquote>}
      </details> : <details className="feedback-answer">
        <summary>Preview the answer you’re sharing</summary>
        <blockquote>{answer}</blockquote>
      </details>}
      {error && <p className="pilot-error" role="alert">{error}</p>}
      <footer className="research-dialog-actions">
        <button type="button" className="research-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="research-primary" disabled={sending || !category || !detail.trim()}>
          {sending ? 'Sending…' : 'Send report'}
        </button>
      </footer>
    </form>}
  </ResearchDialog>;
}
