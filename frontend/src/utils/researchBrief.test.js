import { buildResearchBrief } from './researchBrief';

const sources = Array.from({ length: 6 }, (_, i) => ({ id: `S${i + 1}`, title: `Article ${i + 1}`, url: `https://www.aei.org/article-${i + 1}/` }));

test('briefs retain later scholars and material uncertainty beyond the first four paragraphs', () => {
  const content = [
    'An overall finding. More background detail. [S1]',
    'Will Rinehart discusses regulation. Additional detail. [S2]',
    'Clay Calvert discusses speech. Additional detail. [S3]',
    'Shane Tews discusses networks. Additional detail. [S4]',
    'Brent Orrell discusses skills. Additional detail. [S5]',
    'Cost estimates differ. The estimates are provisional and vary widely under different assumptions. [S6]'
  ].join('\n\n');
  const brief = buildResearchBrief({ content, sources }, 'AI policy');
  expect(brief.findings).toHaveLength(6);
  expect(brief.text).toContain('Brent Orrell discusses skills. [S5]');
  expect(brief.text).toContain('provisional and vary widely');
  expect(brief.text).not.toContain('More background detail');
  expect(brief.references).toHaveLength(6);
});

test('briefs preserve complete conditional statements and coverage gaps without a new model call', () => {
  const brief = buildResearchBrief({ content: 'AI could expand employment, but the evidence remains uncertain. Extra detail. [S1]', sources,
    coverageNotice: 'Selected evidence does not include Clay Calvert.' }, 'Work');
  expect(brief.findings[0]).toBe('AI could expand employment, but the evidence remains uncertain. [S1]');
  expect(brief.text).toContain('Selected evidence does not include Clay Calvert.');
  expect(brief.html).toContain('https://www.aei.org/article-1/');
});

test('briefs remain unavailable for citation failures and entirely limited comparisons', () => {
  expect(buildResearchBrief({ content: 'A claim [S1]', sources, citationNotice: 'Review this answer' }, 'Topic')).toBeNull();
  expect(buildResearchBrief({ comparison: [{ scholar: 'Brent Orrell', limited: true }], sources }, 'Topic')).toBeNull();
});

test('a short web brief preserves the difference between publication and event dates', () => {
  const brief = buildResearchBrief({ sources, content: 'A report describes a spectrum auction plan. The snippet does not itself establish when the plan was announced. Publication timing is not independent proof of an event date. [S1]' }, 'Spectrum');
  expect(brief.text).toContain('does not itself establish');
});

test('brief sentence extraction keeps each sentence’s citations rather than borrowing a dropped sentence’s sources', () => {
  const brief = buildResearchBrief({ content: 'The main finding is supported here. [S1] A background detail appears elsewhere. [S2]', sources }, 'Topic');
  expect(brief.findings[0]).toBe('The main finding is supported here. [S1]');
  expect(brief.references.map(source => source.id)).toEqual(['S1']);
});
