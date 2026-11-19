import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ChatInterface from './ChatInterface';
import DemoWalkthrough from './DemoWalkthrough';

beforeAll(() => { HTMLElement.prototype.scrollIntoView = jest.fn(); });

test('Intern can select one Muse trial without changing the default or comparison settings', async () => {
  const send = jest.fn().mockResolvedValue(null);
  render(<ChatInterface active allowModelTest draftScope="General" onScopeChange={jest.fn()} onSendMessage={send} />);
  const model = screen.getByRole('combobox', { name: 'Answer model' });
  expect(model).toHaveValue('');
  expect(screen.getByText(/App-level question and spending caps disabled/)).toHaveTextContent('16,384 tokens');
  fireEvent.change(model, { target: { value: 'meta-models/Muse-Spark-Open-816B-A42B' } });
  expect(screen.getByText(/Intern-only trial/)).toHaveTextContent('$1.25 input / $4.25 output');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Summarize the article.' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send message' })); });
  expect(send).toHaveBeenCalledWith('Summarize the article.', 'archive', { modelId: 'meta-models/Muse-Spark-Open-816B-A42B' });
});

test('ordinary accounts have no model trial control', () => {
  render(<ChatInterface active draftScope="General" onScopeChange={jest.fn()} onSendMessage={jest.fn()} />);
  expect(screen.queryByRole('combobox', { name: 'Answer model' })).not.toBeInTheDocument();
  expect(screen.queryByText(/spending caps disabled/)).not.toBeInTheDocument();
});

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
