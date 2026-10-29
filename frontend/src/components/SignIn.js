import React, { useState } from 'react';
import { signIn } from '../utils/api';

export default function SignIn() {
  const [account, setAccount] = useState('owner');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await signIn(account, password); }
    catch (problem) { setError(problem.message); }
    finally { setPassword(''); setBusy(false); }
  }
  return <main className="sign-in-page">
    <form className="sign-in-card" onSubmit={submit}>
      <img src="/aeilogo.jpg" alt="AEI" className="sign-in-logo" />
      <p className="eyebrow">INTERNAL RESEARCH</p>
      <h1>AEI Chatbot</h1>
      <p className="sign-in-intro">Sign in to search scholars’ work and ask research questions.</p>
      <label htmlFor="account">Account</label>
      <select id="account" value={account} onChange={event => setAccount(event.target.value)} disabled={busy}>
        <option value="owner">Chatbot Intern</option><option value="supervisor">Chatbot RA</option>
      </select>
      <label htmlFor="password">Password</label>
      <input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={256} required disabled={busy} />
      {error && <p role="alert" className="pilot-error">{error}</p>}
      <button className="pilot-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="sign-in-note">Access is limited to the internal pilot.</p>
    </form>
  </main>;
}
