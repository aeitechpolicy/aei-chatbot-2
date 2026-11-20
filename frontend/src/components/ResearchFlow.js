import React, { useState } from 'react';
import { Globe, Library, Bell } from 'lucide-react';
import ResearchDialog from './ResearchDialog';
import { API_BASE_URL, apiFetch } from '../utils/api';

export const SCOPE_LABELS = { library: 'Scholar Library', aei: 'AEI online', web: 'Wider web' };
export function ModeChoice({ current = 'library', onChoose, disabled }) {
  return <section className="mode-choice" aria-label="Choose the next research step">
    <h3>Continue the research</h3><p>Keep exploring the four-scholar library, or add a brief view from online sources.</p>
    <div className="mode-choice-options">
      <button type="button" disabled={disabled} aria-pressed={current === 'library'} onClick={() => onChoose('library')}><Library size={18} aria-hidden="true" /><strong>Continue in Article Chat</strong><span>Saved publications from the four scholars.</span></button>
      <button type="button" disabled={disabled} aria-pressed={current === 'aei'} onClick={() => onChoose('aei')}><Globe size={18} aria-hidden="true" /><strong>Explore AEI online</strong><span>Additional AEI authors beyond the four library scholars. Online excerpts are separate from the library.</span></button>
      <button type="button" disabled={disabled} aria-pressed={current === 'web'} onClick={() => onChoose('web')}><Globe size={18} aria-hidden="true" /><strong>Explore the wider web</strong><span>External reporting and other sources alongside library evidence.</span></button>
    </div><p className="workspace-meta">Choose a direction, review the question, then select Send.</p>
  </section>;
}
export function ClarificationChoices({ clarification, onChoose, onCustom }) {
  const [custom,setCustom]=useState('');
  const [selected,setSelected]=useState('');
  return <section className="clarification-choices question-card" aria-label="Clarify the question">
    <p className="workspace-kicker">A quick question</p><h3>{clarification.question||'Which direction would be most useful?'}</h3><p className="workspace-meta">{clarification.mode==='web'?(clarification.webScope==='aei'?'Sources: additional AEI authors online.':'Sources: external evidence alongside the Scholar Library.'):clarification.mode==='compare'?'The comparison uses the selected scholars.':'Sources: the selected scholars in the AEI Scholar Library.'}</p>
    <form onSubmit={event=>{event.preventDefault();if(custom.trim())onCustom(custom.trim());else if(selected)onChoose(selected);}}>
      <fieldset><legend>Research direction</legend>{clarification.options.map(option=><label className="clarification-option" key={option.question}>
        <input type="radio" name="research-direction" checked={selected===option.question&&!custom.trim()} onChange={()=>{setSelected(option.question);setCustom('');}} />
        <span>{option.label}</span>
      </label>)}</fieldset>
      <label>Another direction<textarea value={custom} maxLength={2000} onChange={event=>setCustom(event.target.value)} placeholder="Add a custom reply…" rows={1} /></label>
      <div className="question-card-actions">{clarification.originalQuestion&&<button type="button" className="research-secondary" onClick={()=>onChoose(clarification.originalQuestion)}>Skip clarification</button>}
      <button className="research-primary" disabled={!custom.trim()&&!selected}>Use this direction</button></div>
    </form>
    <p className="workspace-meta">The choice prepares a question in the message box. Select Send to continue.</p>
  </section>;
}
export function FollowTopicDialog({ chatId, initialScope='library', onClose, onSaved, showUsage=false }) {
  const [scope,setScope]=useState(initialScope);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  async function save(event){event.preventDefault();setSaving(true);setError('');try{const response=await apiFetch(`${API_BASE_URL}/api/inbox`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId,scope})});const data=await response.json();if(!response.ok)throw new Error(data.error);onSaved();onClose();}catch(e){setError(e.message||'The topic could not be saved.');}finally{setSaving(false);}}
  return <ResearchDialog title="Follow this topic" onClose={onClose}><form className="follow-topic-form" onSubmit={save}><p>Updates stay private to this account. At sign in, due topics are checked once every 24 hours. Signing in again does not repeat an automatic check during that window.</p><fieldset><legend>Choose the sources to follow</legend>{Object.entries(SCOPE_LABELS).map(([value,label])=><label key={value}><input type="radio" name="follow-scope" value={value} checked={scope===value} onChange={()=>setScope(value)} />{label}</label>)}</fieldset><p>Library checks search saved material and do not refresh the collection. Online checks collect brief search excerpts, not complete articles or generated answers. The first check shows current matches; later checks show newly found items. Check for updates can be selected at any time to run a manual check. {showUsage&&'Each online check uses search credits.'}</p>{error&&<p role="alert">{error}</p>}<footer className="research-dialog-actions"><button type="button" className="research-secondary" onClick={onClose}>Cancel</button><button className="research-primary" disabled={saving}><Bell size={16} aria-hidden="true" />{saving?'Saving…':'Follow topic'}</button></footer></form></ResearchDialog>;
}
