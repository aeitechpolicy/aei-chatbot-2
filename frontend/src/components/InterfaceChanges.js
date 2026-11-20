import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import ResearchDialog from './ResearchDialog';
import BeforeAfterPreview from './BeforeAfterPreview';

export default function InterfaceChanges({ onClose, onStartTour, onBack }) {
  return <ResearchDialog title="Before-and-after" onClose={onClose} className="onboarding-dialog interface-changes-dialog"
    closeLabel="Continue to guided demo" closeText="Continue to demo →">
    <div className="interface-changes onboarding-body">
      <p className="onboarding-stages">2 of 3 · See the change</p>
      <BeforeAfterPreview />
    </div>
    <footer className="research-dialog-actions walkthrough-actions">
      <button type="button" className="research-secondary" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
      <p className="onboarding-next">Next: an interactive, nine-step guided demo.</p>
      <button type="button" className="research-primary" onClick={onStartTour}>Start guided demo <ArrowRight size={16} aria-hidden="true" /></button>
    </footer>
  </ResearchDialog>;
}
