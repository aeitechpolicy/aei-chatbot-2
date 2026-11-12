import { fireEvent, render, screen, within } from '@testing-library/react';
import ArticleSearch from './ArticleSearch';
import { apiFetch } from '../utils/api';
jest.mock('../utils/api', () => ({ API_BASE_URL: 'http://test', apiFetch: jest.fn() }));
beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ lastSuccessfulRefresh: '2025-01-10', latestPublishedDate: '2025-01-02' }) });
});
const result = { articles: [{ id: 'S1', sourceRef: 'a'.repeat(64), title: 'A saved article', author: 'Brent Orrell', date: '2025-01-02', url: 'https://www.aei.org/articles/example/', body: 'An exact saved passage about workforce training.', fullText: true }], mode: 'topic', matchedCount: 1, coverage: { articles: 1500 }, aiUsed: false };
test('article search displays update dates and recorded sources without starting a chat', async () => {
  apiFetch.mockResolvedValue({ ok: true, json: async () => result });
  render(<ArticleSearch />);
  fireEvent.change(screen.getByLabelText('Topic or research question'), { target: { value: 'AI and workforce' } });
  fireEvent.change(screen.getByLabelText('Scholar'), { target: { value: 'Brent_Orrell' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search saved articles' }));
  const link = await screen.findByRole('link', { name: 'A saved article' });
  expect(await screen.findByText('Jan 10, 2025')).toBeVisible();
  expect(screen.getByText('Library refreshed on')).toBeVisible();
  fireEvent.click(screen.getByText('Refresh details'));
  expect(screen.getByText('Jan 2, 2025')).toBeVisible();
  expect(link).toHaveAttribute('href', 'https://www.aei.org/articles/example/');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveTextContent('Open on AEI');
  expect(screen.getByText('An exact saved passage about workforce training.')).toBeInTheDocument();
  expect(apiFetch).toHaveBeenCalledTimes(2);
  expect(apiFetch.mock.calls[0][0]).toBe('http://test/api/research/status');
  expect(apiFetch.mock.calls[1][0]).toContain('/api/research/search?q=AI+and+workforce&scholar=Brent_Orrell');
});
test('sending a source correction shares the selected reference and explanation', async () => {
  apiFetch.mockResolvedValueOnce({ ok: true, json: async () => result }).mockResolvedValueOnce({ ok: true });
  render(<ArticleSearch />);
  fireEvent.click(screen.getByRole('button', { name: 'Explore a recent sample' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Send to the team: A saved article' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Send to the team' }));
  fireEvent.change(dialog.getByLabelText('What went wrong?'), { target: { value: 'Incorrect title, byline or date' } });
  fireEvent.change(dialog.getByLabelText('What should the team know?'), { target: { value: 'Please correct the byline.' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Send report' }));
  expect(await dialog.findByRole('status')).toHaveTextContent('Your report was sent to the staff inbox.');
  const [url, request] = apiFetch.mock.calls[2];
  expect(url).toBe('http://test/api/research/feedback');
  expect(JSON.parse(request.body)).toEqual({ sourceRef: result.articles[0].sourceRef, category: 'Incorrect title, byline or date', detail: 'Please correct the byline.' });
});
test('no matches and archive failures show useful messages without offering a paid retry', async () => {
  apiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...result, articles: [], matchedCount: 0 }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Archive temporarily unavailable.' }) });
  render(<ArticleSearch />);
  fireEvent.change(screen.getByLabelText('Topic or research question'), { target: { value: 'unmatched' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search saved articles' }));
  expect(await screen.findByText(/No matching articles found/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Search saved articles' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Archive temporarily unavailable.');
  expect(apiFetch).toHaveBeenCalledTimes(3);
});

test('the recent-sample action searches immediately and labels the result as a sample', async () => {
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ ...result, mode: 'overview' }) });
  render(<ArticleSearch />);
  fireEvent.click(screen.getByRole('button', { name: 'Explore a recent sample' }));
  expect(await screen.findByText(/Showing a recent sample of 1 saved articles/)).toBeInTheDocument();
  expect(apiFetch.mock.calls[1][0]).toContain('q=main+themes');
  expect(screen.getByText(/not a complete review/)).toBeInTheDocument();
});
