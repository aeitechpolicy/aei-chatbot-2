import React, { Children, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, X } from 'lucide-react';

export default function ResearchDialog({ title, children, onClose, className = '', closeLabel = 'Close dialog', closeText, paged=false, scrollKey=0 }) {
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);
  const contentRef = useRef(null);
  const [moreBelow,setMoreBelow]=useState(false);
  const headingId = useId();
  useLayoutEffect(()=>{
    const body=bodyRef.current;
    if (!paged || !body) return undefined;
    body.scrollTop=0;
    const update=()=>setMoreBelow(body.scrollHeight-body.clientHeight-body.scrollTop>8);
    update();body.addEventListener('scroll',update);
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):null;
    observer?.observe(body);if(contentRef.current)observer?.observe(contentRef.current);
    return()=>{body.removeEventListener('scroll',update);observer?.disconnect();};
  },[paged,scrollKey]);
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

  const parts=Children.toArray(children);
  const footer=parts.filter(child=>child.type==='footer');
  return <dialog ref={dialogRef} className={`research-dialog ${className} ${paged?'paged-guide-dialog':''}`} aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="research-dialog-header">
      <h2 id={headingId}>{title}</h2>
      <button type="button" onClick={onClose} aria-label={closeLabel}>{closeText || <X size={20} />}</button>
    </header>
    {paged ? <>
      <button type="button" className="guide-scroll-cue" hidden={!moreBelow} onClick={()=>{const body=bodyRef.current;if(body)body.scrollTop+=Math.max(120,body.clientHeight*.65);}}>More below <ArrowDown size={15} aria-hidden="true" /></button>
      <div ref={bodyRef} className="guide-scroll-body" aria-label="Guide content"><div ref={contentRef}>{parts.filter(child=>child.type!=='footer')}</div></div>
      {footer}
    </> : children}
  </dialog>;
}
