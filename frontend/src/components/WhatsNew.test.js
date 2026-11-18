import { fireEvent, render, screen } from '@testing-library/react';
import WhatsNew from './WhatsNew';
import InterfaceChanges from './InterfaceChanges';

test('overview navigation identifies the required comparison before the demo', () => {
  const next = jest.fn(); const close = jest.fn();
  render(<WhatsNew onClose={close} onContinue={next} />);
  expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Start guided demo' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Before and now interface comparison' })).not.toBeInTheDocument();
  expect(screen.getByText('1 of 3 · What’s new')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'See the change', exact: true }));
  expect(next).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Continue to before-and-after comparison', exact: true }));
  expect(close).toHaveBeenCalledTimes(1);
});

test('the separate comparison screen opens the original interface and leads into the demo', () => {
  const start = jest.fn(); const back = jest.fn();
  render(<InterfaceChanges onClose={start} onStartTour={start} onBack={back} />);
  expect(screen.getByRole('dialog', { name: 'Before-and-after' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Before and now interface comparison' })).toBeVisible();
  expect(screen.getByText('2 of 3 · See the change')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Version 2.0 November 2026' }));
  expect(screen.getByRole('img', { name: /Version 2.0, November 2026/ })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
  expect(back).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Start guided demo', exact: true }));
  expect(start).toHaveBeenCalledTimes(1);
});
