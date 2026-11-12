import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const documentHtml = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/legacy-chatbot.css"></head><body><div id="legacy-root"></div></body></html>';

export default function LegacyFrame({ children }) {
  const [mount, setMount] = useState(null);
  return <>
    <iframe className="legacy-preview-frame" title="Version 1.0 chatbot" srcDoc={documentHtml}
      onLoad={event => setMount(event.currentTarget.contentDocument?.getElementById('legacy-root') || null)} />
    {mount && createPortal(children, mount)}
  </>;
}
