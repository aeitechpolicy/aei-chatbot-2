import React, { useEffect, useState } from 'react';
import { API_BASE_URL, apiFetch } from '../utils/api';

const money = value => value === null || value === undefined ? 'Unknown' : `$${Number(value).toFixed(5)}`;
export default function UsageReport() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  async function refresh() {
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/usage`);
      if (!response.ok) throw new Error('The usage report could not be loaded.');
      setData(await response.json());
    } catch (problem) { setError(problem.message); }
  }
  useEffect(() => { refresh(); }, []);
  async function download() {
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/usage.csv`);
      if (!response.ok) throw new Error('The report could not be downloaded.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'aei-chatbot-usage.csv'; anchor.click();
      URL.revokeObjectURL(url);
    } catch (problem) { setError(problem.message); }
  }
  const rows = data ? data.rows : [];
  const known = rows.reduce((sum, row) => sum + (row.estimated_usd || 0), 0);
  const uncertain = rows.filter(row => row.estimated_usd === null).length;
  const status = row => ({ complete: 'Answered', failed: 'Answer failed', not_sent: 'Not sent', pending: 'Outcome uncertain', unknown_cost: 'Cost uncertain' }[row.status] || row.status);
  return <main className="usage-report">
    <div className="usage-heading"><div><p className="eyebrow">INTERNAL PILOT</p><h2>Usage and costs</h2></div>
      <div className="pilot-actions"><button onClick={refresh}>Refresh</button><button className="pilot-primary" onClick={download}>Download CSV</button></div>
    </div>
    <p>Review requests made through this chatbot. Estimated costs can differ from Together’s final bill.</p>
    {error && <p role="alert" className="pilot-error">{error}</p>}
    {!data && !error && <p role="status">Loading usage…</p>}
    {data && <>
      <div className="usage-totals"><div><span>Recorded requests</span><strong>{rows.length}</strong></div><div><span>Known cost estimates</span><strong>{money(known)}</strong></div><div><span>Uncertain outcomes or costs</span><strong>{uncertain}</strong></div></div>
      {!data.settings.storageConfigured && <p className="pilot-error">The free database must be connected before AI answers can be enabled.</p>}
      <p className="usage-note">Daily pilot allowances: {data.settings.dailyQuestions} requests in total, up to {data.settings.personQuestions} per account, and ${data.settings.dailyBudget.toFixed(2)} in estimated usage. Days reset at midnight UTC. Requests with unknown costs retain a conservative allowance.</p>
      <p className="usage-note">Estimate basis: {data.settings.priceSource}.</p>
      <div className="usage-table-wrap"><table className="usage-table"><thead><tr><th>Time (Eastern)</th><th>Account</th><th>Model</th><th>Result</th><th>Estimated cost</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id}><td>{new Date(row.started_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td><td>{row.user_id === 'owner' ? 'Chatbot Intern' : 'Chatbot RA'}</td><td>{row.model.split('/').pop()}</td><td>{status(row)}</td><td>{money(row.estimated_usd)}</td></tr>)}
        {!rows.length && <tr><td colSpan="5">No requests recorded yet.</td></tr>}
      </tbody></table></div>
      <p className="usage-note">Shows up to 5,000 recent requests. This report does not include activity that bypasses the chatbot. Check Together’s billing page for the account’s complete charges.</p>
    </>}
  </main>;
}
