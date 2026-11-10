import { render, screen } from '@testing-library/react';
import MessageList from './MessageList';

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

test('numbered citations link only to recorded AEI sources, with excerpts and a saved citation notice', () => {
  const sources = [{ id: 'S1', title: 'Recorded article', author: 'Shane Tews', url: 'https://www.aei.org/articles/recorded/', excerpt: 'The source passage.', date: null }, { id: 'S2', title: 'Unsafe link', url: 'javascript:alert(1)', excerpt: '<img src=x onerror=alert(1)>' }];
  const { container } = render(<MessageList messages={[{ role: 'assistant', content: 'An observation [S1]. Another [S2]. An unknown [S3].', sources, citationNotice: 'Check this quotation.' }]} loading={false} />);
  expect(screen.getByRole('link', { name: '[S1]' })).toHaveAttribute('href', 'https://www.aei.org/articles/recorded/');
  expect(screen.queryByRole('link', { name: '[S2]' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '[S3]' })).not.toBeInTheDocument();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByRole('note')).toHaveTextContent('Check this quotation.');
  expect(container.textContent).toContain('Date not recorded');
});
