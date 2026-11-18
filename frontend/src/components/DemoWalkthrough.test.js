import { act, fireEvent, render, screen, within } from '@testing-library/react';
import DemoWalkthrough from './DemoWalkthrough';
import { apiFetch } from '../utils/api';
jest.mock('../utils/api', () => ({ ...jest.requireActual('../utils/api'), apiFetch: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('the guided practice completes search, citation, brief and feedback without API calls', () => {
  const onTryQuestion = jest.fn();
  render(<DemoWalkthrough showWhatsNewLink onClose={jest.fn()} onOpenSearch={jest.fn()} onTryQuestion={onTryQuestion} />);
  expect(screen.getByText('0 of 6 complete')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'AEI Article Search', exact: true }));
  fireEvent.change(screen.getByLabelText('Search the sample library'), { target: { value: 'Greg Oslan' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  expect(screen.getByRole('article', { name: 'Practice search result' })).toHaveTextContent('Why Is It So Hard to Stay Safe Online?');
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
  expect(screen.getByRole('article', { name: 'Prepared sample answer' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Open sample citation S1' }));
  expect(screen.getByRole('region', { name: 'Sample source passage' })).toHaveTextContent('Guest: Greg Oslan');
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview research brief' }));
  const brief = screen.getByRole('dialog', { name: 'Research brief' });
  expect(brief).toHaveTextContent('Protecting personal accounts');
  fireEvent.click(within(brief).getByRole('button', { name: 'Close dialog' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
  expect(screen.getByRole('article', { name: 'Prepared AEI plus Web answer' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Open sample web citation W1' }));
  expect(screen.getByRole('region', { name: 'Sample outside source passage' })).toHaveTextContent('NIST');
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Send to the team', exact: true }));
  const feedback = screen.getByRole('dialog', { name: 'Send to the team' });
  expect(feedback).toHaveTextContent('nothing you enter here is sent to staff');
  fireEvent.change(within(feedback).getByLabelText('What went wrong?'), { target: { value: 'Missing context' } });
  fireEvent.change(within(feedback).getByLabelText('What should the team know?'), { target: { value: 'A point needs more context.' } });
  fireEvent.click(within(feedback).getByRole('button', { name: 'Try sending sample report' }));
  expect(within(feedback).getByRole('status')).toHaveTextContent('No report was sent');
  fireEvent.click(within(feedback).getByRole('button', { name: 'Done' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish tour' }));
  expect(screen.getByText('6 of 6 complete')).toBeVisible();
  expect(screen.getByText(/You can revisit this demo anytime/)).toBeVisible();
  expect(screen.getByRole('heading', { name: 'You’re ready to explore' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Open this question in Article Chat' }));
  expect(onTryQuestion).toHaveBeenCalledWith('What does Greg Oslan recommend for protecting personal accounts?');
  expect(apiFetch).not.toHaveBeenCalled();
});

test('the practice can be skipped or restarted and other mode buttons never run a search', () => {
  const onClose = jest.fn();
  render(<DemoWalkthrough onClose={onClose} onOpenSearch={jest.fn()} onTryQuestion={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'AEI + Web', exact: true }));
  expect(screen.getByText(/prepared example, not a live search/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'AEI Article Search', exact: true }));
  fireEvent.change(screen.getByLabelText('Search the sample library'), { target: { value: 'A different topic' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  expect(screen.getByRole('alert')).toHaveTextContent('For this practice example, search Greg Oslan');
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
  expect(screen.getByText('0 of 6 complete')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(apiFetch).not.toHaveBeenCalled();
});


test('Next demonstrates every unfinished step, including web and feedback, without any API call', async () => {
  jest.useFakeTimers();
  try {
    render(<DemoWalkthrough onClose={jest.fn()} onOpenSearch={jest.fn()} onTryQuestion={jest.fn()} />);
    for (let index = 0; index < 6; index++) {
      fireEvent.click(screen.getByRole('button', { name: index === 5 ? 'Finish tour' : 'Next', exact: true }));
      await act(async () => { jest.advanceTimersByTime(650); await Promise.resolve(); });
      await act(async () => { jest.advanceTimersByTime(1200); await Promise.resolve(); });
    }
    expect(screen.getByText('6 of 6 complete')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'You’re ready to explore' })).toBeVisible();
    expect(apiFetch).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
