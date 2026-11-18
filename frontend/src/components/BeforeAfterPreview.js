import React, { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const scenes = [
  { title: 'Version 1.0', date: 'Pre-September 2026', image: '/tour-version1.png',
    text: 'The original interface grouped chats and scholar files in a sidebar.', points: ['Original chat and scholar selector', 'Original collection of articles', 'Basic chat workflow'] },
  { title: 'Version 2.0', date: 'November 2026', image: '/tour-version2.png',
    text: 'The new workspace brings research, evidence and follow-up actions together.', points: ['Four clear research modes', 'Search dates, passages and AEI links', 'Citation passages and brief previews', 'Private saved chats and team feedback'] }
];
export default function BeforeAfterPreview() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(() => !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => setScene(value => (value + 1) % scenes.length), 4500);
    return () => clearInterval(timer);
  }, [playing]);
  const current = scenes[scene];
  return <section className="before-after-preview" aria-label="Before and now interface comparison">
    <div className="before-after-heading"><div><p className="workspace-kicker">See the change</p><h3>From the original chatbot to a research workspace</h3></div>
      <button type="button" className="research-secondary" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause interface comparison' : 'Play interface comparison'}>
        {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{playing ? 'Pause' : 'Play'}
      </button>
    </div>
    <div className="before-after-tabs" role="group" aria-label="Choose comparison version">{scenes.map((item, index) => <button type="button" key={item.title} aria-pressed={scene === index}
      onClick={() => { setPlaying(false); setScene(index); }}><strong>{item.title}</strong><span>{item.date}</span></button>)}</div>
    <figure className="before-after-screen"><img key={scene} src={current.image} alt={`${current.title}, ${current.date}: ${current.text}`} />
      <figcaption><strong>{current.title} · {current.date}</strong><span>{current.text}</span></figcaption>
    </figure>
    <ul className="before-after-points">{current.points.map(point => <li key={point}>{point}</li>)}</ul>
    <p className="before-after-note">Screens show the preserved original interface and the November interface with sample sessions. Try either usable version from the version buttons after the tour.</p>
  </section>;
}
