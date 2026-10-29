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
