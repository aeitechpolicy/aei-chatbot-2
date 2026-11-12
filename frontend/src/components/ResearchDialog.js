import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function ResearchDialog({ title, children, onClose }) {
  const dialogRef = useRef(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      opener?.focus();
    };
  }, []);

  return <dialog ref={dialogRef} className="research-dialog" aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="research-dialog-header">
      <h2 id={headingId}>{title}</h2>
      <button type="button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
    </header>
    {children}
  </dialog>;
}
