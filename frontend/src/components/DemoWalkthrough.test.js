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
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
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
  expect(screen.getByRole('region', { name: 'Where to find help again' })).toHaveTextContent('top-right corner of the chatbot');
  expect(screen.getByRole('img', { name: /Screenshot of the top-right chatbot toolbar/ })).toHaveAttribute('src', '/tour-help-header.png');
  expect(screen.getByRole('heading', { name: 'You can come back anytime' })).toHaveFocus();
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


test('automatic demonstrations wait indefinitely for Next, including both passages, brief and feedback', async () => {
  jest.useFakeTimers();
  try {
    render(<DemoWalkthrough onClose={jest.fn()} onOpenSearch={jest.fn()} onTryQuestion={jest.fn()} />);
    const titles = ['Choose a mode', 'Find an article', 'Open the citation', 'Preview a research brief', 'Try AEI + Web', 'Report a problem'];
    for (let index = 0; index < 6; index++) {
      const tour = within(screen.getByRole('dialog', { name: 'Try AEI Chatbot' }));
      fireEvent.click(tour.getByRole('button', { name: 'Next', exact: true }));
      await act(async () => { jest.advanceTimersByTime(650); await Promise.resolve(); });
      await act(async () => { jest.advanceTimersByTime(60000); await Promise.resolve(); });
      expect(tour.getByRole('heading', { name: titles[index], exact: true })).toBeVisible();
      if (index === 1) expect(tour.getByRole('article', { name: 'Practice search result' })).toBeVisible();
      if (index === 2) expect(tour.getByRole('region', { name: 'Sample source passage' })).toBeVisible();
      if (index === 4) expect(tour.getByRole('region', { name: 'Sample outside source passage' })).toBeVisible();
      if (index === 3) {
        const brief = within(screen.getByRole('dialog', { name: 'Research brief' }));
        expect(brief.getByText('Key findings')).toBeVisible();
        fireEvent.click(brief.getByRole('button', { name: 'Next', exact: true }));
      } else if (index === 5) {
        const feedback = within(screen.getByRole('dialog', { name: 'Send to the team' }));
        expect(feedback.getByLabelText('What went wrong?')).toHaveValue('Incorrect information');
        expect(feedback.getByLabelText('What should the team know?')).toHaveValue('Practice example: please check the attribution in this answer.');
        expect(feedback.queryByText('Practice complete. No report was sent.')).not.toBeInTheDocument();
        fireEvent.change(feedback.getByLabelText('What should the team know?'), { target: { value: 'I can edit and review this at my own pace.' } });
        await act(async () => { jest.advanceTimersByTime(60000); await Promise.resolve(); });
        expect(feedback.getByLabelText('What should the team know?')).toHaveValue('I can edit and review this at my own pace.');
        fireEvent.click(feedback.getByRole('button', { name: 'Next', exact: true }));
      } else fireEvent.click(tour.getByRole('button', { name: 'Next', exact: true }));
    }
    expect(screen.getByText('6 of 6 complete')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'You can come back anytime' })).toHaveFocus();
    expect(apiFetch).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
