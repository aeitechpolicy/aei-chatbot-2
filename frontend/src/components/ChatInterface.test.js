import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ChatInterface from './ChatInterface';
import DemoWalkthrough from './DemoWalkthrough';

beforeAll(() => { HTMLElement.prototype.scrollIntoView = jest.fn(); });

test('comparison picker sends only selected scholars and prevents a one-scholar request', async () => {
  const send = jest.fn().mockResolvedValue(null);
  render(<ChatInterface active comparisonMode draftScope="General" onScopeChange={jest.fn()} onSendMessage={send} />);
  const picker = screen.getByRole('group', { name: /Choose scholars to compare/ });
  fireEvent.click(within(picker).getByRole('button', { name: 'Brent Orrell' }));
  fireEvent.click(within(picker).getByRole('button', { name: 'Will Rinehart' }));
  fireEvent.click(within(picker).getByRole('button', { name: 'Shane Tews' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'How do they approach regulation?' } });
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(within(picker).getByRole('button', { name: 'Shane Tews' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send message' })); });
  expect(send).toHaveBeenCalledWith('How do they approach regulation?', 'compare', { comparisonScholars: ['Clay_Calvert', 'Shane_Tews'] });
});

test('guided demo includes a selectable comparison category and a seventh tour step', () => {
  render(<DemoWalkthrough onClose={jest.fn()} onTryQuestion={jest.fn()} onOpenSearch={jest.fn()} />);
  expect(screen.getByRole('button', { name: /Step 7 Compare selected scholars/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Compare Scholars', exact: true }));
  const picker = screen.getByRole('group', { name: 'Practice: choose scholars to compare' });
  fireEvent.click(within(picker).getByRole('button', { name: 'Clay Calvert' }));
  fireEvent.click(within(picker).getByRole('button', { name: 'Shane Tews' }));
  const panels = within(screen.getByLabelText('Practice selected scholars'));
  expect(panels.getByRole('heading', { name: 'Clay Calvert' })).toBeVisible();
  expect(panels.getByRole('heading', { name: 'Shane Tews' })).toBeVisible();
  expect(panels.queryByRole('heading', { name: 'Brent Orrell' })).not.toBeInTheDocument();
});
