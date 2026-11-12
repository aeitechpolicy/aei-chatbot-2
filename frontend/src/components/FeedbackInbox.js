import React, { useEffect, useState } from 'react';
import { API_BASE_URL, apiFetch } from '../utils/api';

export default function FeedbackInbox() {
  const [reload, setReload] = useState(0);
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setReports(null);
    setError('');
    async function load() {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/feedback`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The feedback inbox could not be opened.');
        if (!controller.signal.aborted) setReports(data.reports);
      } catch (problem) {
        if (!controller.signal.aborted) setError(problem.message || 'The feedback inbox could not be opened.');
      }
    }
    load();
    return () => controller.abort();
  }, [reload]);

  return <main className="feedback-inbox">
    <div className="feedback-inbox-heading">
      <h2>Feedback inbox</h2>
      <button type="button" className="research-secondary" onClick={() => setReload(value => value + 1)}>Refresh</button>
    </div>
    {error && <p role="alert" className="pilot-error">{error}</p>}
    {!error && reports === null && <p role="status">Loading reports…</p>}
    {reports?.length === 0 && <p>No reports have been sent.</p>}
    {reports?.map(report => <article key={report.id} className="feedback-report">
      <h3>{report.category}</h3>
      <p className="source-metadata">{report.reporterLabel} · <time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time></p>
      <p className="feedback-detail">{report.detail}</p>
      <details className="feedback-answer">
        <summary>Reported answer</summary>
        <blockquote>{report.answer}</blockquote>
      </details>
    </article>)}
  </main>;
}
