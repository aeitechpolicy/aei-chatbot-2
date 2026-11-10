import { fireEvent, render, screen } from '@testing-library/react';
import ArticleSearch from './ArticleSearch';
import { apiFetch } from '../utils/api';
jest.mock('../utils/api', () => ({ API_BASE_URL: 'http://test', apiFetch: jest.fn() }));
beforeEach(() => apiFetch.mockReset());
const result = { articles: [{ id: 'S1', title: 'A saved article', author: 'Brent Orrell', date: '2025-01-02', url: 'https://www.aei.org/articles/example/', body: 'An exact saved passage about workforce training.', fullText: true }], mode: 'topic', matchedCount: 1, coverage: { articles: 1500 }, aiUsed: false };
test('article search displays recorded sources and sends only a search request, with no chat or AI call', async () => {
  apiFetch.mockResolvedValue({ ok: true, json: async () => result });
  render(<ArticleSearch />);
  fireEvent.change(screen.getByLabelText('Topic or research question'), { target: { value: 'AI and workforce' } });
  fireEvent.change(screen.getByLabelText('Scholar'), { target: { value: 'Brent_Orrell' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search saved articles' }));
  const link = await screen.findByRole('link', { name: 'A saved article' });
  expect(link).toHaveAttribute('href', 'https://www.aei.org/articles/example/');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveTextContent('Open on AEI');
  expect(screen.getByText('An exact saved passage about workforce training.')).toBeInTheDocument();
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(apiFetch.mock.calls[0][0]).toContain('/api/research/search?q=AI+and+workforce&scholar=Brent_Orrell');
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
  expect(apiFetch).toHaveBeenCalledTimes(2);
});

test('the recent-sample action searches immediately and labels the result as a sample', async () => {
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ ...result, mode: 'overview' }) });
  render(<ArticleSearch />);
  fireEvent.click(screen.getByRole('button', { name: 'Explore a recent sample' }));
  expect(await screen.findByText(/Showing a recent sample of 1 saved articles/)).toBeInTheDocument();
  expect(apiFetch.mock.calls[0][0]).toContain('q=main+themes');
  expect(screen.getByText(/not a complete review/)).toBeInTheDocument();
});
