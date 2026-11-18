import React from 'react';
import { interviewLinks, sourceTypeLabel } from '../utils/sources';

export default function InterviewDetails({ source }) {
  const label = sourceTypeLabel(source);
  if (!label) return null;
  const participants = source.interview?.participants?.join(', ');
  return <div className="source-interview-details">
    <p className="source-coverage">{label}{participants ? ` · Interview participants: ${participants}` : ''}</p>
    {source.interview?.extractionMethod === 'ocr' && <p className="source-coverage">Text read from a scanned PDF. Verify exact quotations in the original.</p>}
    {!!source.interview?.unverifiedSpeakerLabels?.length && <p className="source-coverage">Some printed speaker labels need review; uncertain turns are marked in the passage.</p>}
    {interviewLinks(source).map(link => <p key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></p>)}
  </div>;
}
