import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MessageList from './MessageList';
import { apiFetch } from '../utils/api';

jest.mock('../utils/api', () => ({ ...jest.requireActual('../utils/api'), apiFetch: jest.fn() }));

beforeAll(() => { HTMLElement.prototype.scrollIntoView = jest.fn(); });

test('model and source HTML stays plain text rather than becoming executable markup', () => {
  const payload = '<img src=x onerror="window.privateMarker=1"><script>window.privateMarker=2</script>';
  const { container } = render(<MessageList messages={[{ role: 'assistant', content: `${payload}\n[Source: Article ${payload}]` }]} loading={false} />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('script')).toBeNull();
  expect(container.textContent).toContain(payload);
  expect(container.querySelector('.inline-citation').textContent).toContain(payload);
  expect(window.privateMarker).toBeUndefined();
});

test('basic emphasis, code and source badges still render', () => {
  const { container } = render(<MessageList messages={[{ role: 'assistant', content: '**Strong text** and *emphasis* and `code`\n[Source: Article title]' }]} loading={false} />);
  expect(container.querySelector('strong')).toHaveTextContent('Strong text');
  expect(container.querySelector('em')).toHaveTextContent('emphasis');
  expect(container.querySelector('code')).toHaveTextContent('code');
  expect(screen.getByText(/Article title/)).toHaveClass('inline-citation');
});

test('numbered citations open their exact recorded passage and reject unsafe article links', () => {
  const sources = [{ id: 'S1', title: 'Recorded article', author: 'Shane Tews', url: 'https://www.aei.org/articles/recorded/', excerpt: 'The source passage.', date: null }, { id: 'S2', title: 'Unsafe link', url: 'javascript:alert(1)', excerpt: '<img src=x onerror=alert(1)>' }];
  const { container } = render(<MessageList messages={[{ role: 'assistant', content: 'An observation [S1]. Another [S2]. An unknown [S3].', sources, citationNotice: 'Check this quotation.' }]} loading={false} />);
  const citation = screen.getByRole('button', { name: 'View passage [S1]' });
  fireEvent.click(citation);
  expect(screen.getByRole('complementary', { name: 'Passage [S1]' })).toHaveTextContent('The source passage.');
  expect(screen.getByRole('link', { name: 'Open on AEI' })).toHaveAttribute('href', 'https://www.aei.org/articles/recorded/');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Close passage' }), { key: 'Escape' });
  expect(citation).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'View passage [S2]' }));
  expect(screen.queryByRole('link', { name: 'Open on AEI' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'View passage [S3]' })).not.toBeInTheDocument();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByRole('note')).toHaveTextContent('Check this quotation.');
  expect(container.textContent).toContain('Date not recorded');
});

test('copies a brief with source URLs and offers follow-ups without submitting them', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  try {
    const onFollowUp = jest.fn();
    const sources = [{ id: 'W1', kind: 'web', title: 'Current policy', publisher: 'example.org', url: 'https://example.org/policy', excerpt: 'Web passage.' }];
    render(<MessageList title="Policy brief" chatId="test-chat" loading={false} onFollowUp={onFollowUp} messages={[{
      role: 'assistant', searchMode: 'web', content: 'A policy example [W1].', sources,
      followUps: ['What tradeoffs should we examine next?']
    }]} />);
    const summary = screen.getByText('Sources (1)').closest('summary');
    const sourcesPanel = summary.closest('details');
    expect(sourcesPanel).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Send to the team' }).closest('details')).toBeNull();
    fireEvent.click(summary);
    expect(sourcesPanel).toHaveAttribute('open');
    fireEvent.click(within(sourcesPanel).getByRole('button', { name: 'Preview research brief' }));
    const preview = screen.getByRole('dialog', { name: 'Research brief' });
    expect(within(preview).getByText('Policy brief')).toBeVisible();
    expect(within(preview).getByRole('link', { name: '[W1]' })).toHaveAttribute('href', 'https://example.org/policy');
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(within(preview).getByRole('button', { name: 'Copy brief' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://example.org/policy')));
    expect(await screen.findByText('Research brief copied.')).toBeVisible();
    fireEvent.click(within(preview).getByRole('button', { name: 'Close dialog' }));
    fireEvent.click(screen.getByRole('button', { name: 'View passage [W1]' }));
    expect(screen.getByRole('link', { name: 'Open web source' })).toHaveAttribute('href', 'https://example.org/policy');
    fireEvent.click(screen.getByRole('button', { name: 'What tradeoffs should we examine next?' }));
    expect(onFollowUp).toHaveBeenCalledWith('What tradeoffs should we examine next?');
  } finally {
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
    else delete navigator.clipboard;
  }
});

test('AEI + Web can report a selected source separately from the full answer', async () => {
  apiFetch.mockResolvedValueOnce({ ok: true });
  const sources = [{ id: 'W1', kind: 'web', title: 'Current policy', url: 'https://example.org/policy', excerpt: 'Web passage.' }];
  render(<MessageList chatId="test-chat" loading={false} messages={[{ role: 'assistant', searchMode: 'web', content: 'A policy example [W1].', sources }]} />);
  expect(screen.getByRole('button', { name: 'Send to the team' })).toBeVisible();
  fireEvent.click(screen.getByText('Sources (1)').closest('summary'));
  fireEvent.click(screen.getByRole('button', { name: 'Send to the team: Current policy' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Send to the team' }));
  fireEvent.change(dialog.getByLabelText('What went wrong?'), { target: { value: 'Broken or incorrect link' } });
  fireEvent.change(dialog.getByLabelText('What should the team know?'), { target: { value: 'The link is outdated.' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Send report' }));
  expect(await dialog.findByRole('status')).toHaveTextContent('Your report was sent to the staff inbox.');
  const [url, request] = apiFetch.mock.calls[0];
  expect(url).toContain('/api/chat/test-chat/feedback');
  expect(JSON.parse(request.body)).toEqual({ sourceId: 'W1', messageIndex: 0, category: 'Broken or incorrect link', detail: 'The link is outdated.' });
});
