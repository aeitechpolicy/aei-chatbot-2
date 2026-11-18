import { fireEvent, render, screen } from '@testing-library/react';
import WhatsNew from './WhatsNew';

test('welcome actions identify the next demo and jump directly to the interface comparison', () => {
  const start = jest.fn(); const close = jest.fn();
  HTMLElement.prototype.scrollIntoView = jest.fn();
  render(<WhatsNew onClose={close} onStartTour={start} />);
  expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue to guided demo' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'See the before-and-after', exact: true }));
  const comparison = screen.getByRole('region', { name: 'Before-and-after details' });
  expect(comparison).toHaveFocus();
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start guided demo', exact: true }));
  expect(start).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Continue to guided demo', exact: true }));
  expect(close).toHaveBeenCalledTimes(1);
});
