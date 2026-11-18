import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ModelTester from './ModelTester';
import { apiFetch } from '../utils/api';

jest.mock('../utils/api', () => ({
  API_BASE_URL: 'http://test', apiFetch: jest.fn(), chatEndpoint: route => `http://test/api/chat/${route}`, signOut: jest.fn()
}));
jest.mock('./ArticleSearch', () => ({ active }) => active ? <p>Shared library search results</p> : null);

const models = [
  { id: 'Qwen/Qwen3.8-Flash', label: 'Qwen3.8 Flash', inputRate: 0.15, outputRate: 0.47 },
  { id: 'zai-org/GLM-5.3-Flash', label: 'GLM-5.3-Flash', inputRate: 0.15, outputRate: 0.50 },
  { id: 'openai/gpt-oss-120b', label: 'gpt-oss-120B', inputRate: 0.15, outputRate: 0.60 }
];
const source = { id: 'S1', title: 'Spectrum article', author: 'Shane Tews', date: '2026-11-10',
  url: 'https://www.aei.org/articles/spectrum/', excerpt: 'A recorded spectrum passage.' };
const session = { user: { id: 'tester', label: 'Model Tester' } };
const current = { id: 'comparison-1', title: 'Spectrum Policy', domainName: 'General', messages: [] };
const reply = { chat: { ...current, messages: [{ role: 'user', content: 'What does Shane say?' }, {
  role: 'assistant', content: 'Model comparison', sources: [source], searchMode: 'archive',
  modelResponses: models.map((model, index) => ({ model: model.id, label: model.label, role: 'assistant',
    status: index === 1 ? 'failed' : 'complete', content: 'A candidate answer. [S1]', error: 'This model could not complete its answer (HTTP 503).',
    elapsedMs: 1200, estimatedUsd: index === 1 ? null : 0.0002, usageRecorded: true }))
}] } };

beforeEach(() => {
  apiFetch.mockReset();
  HTMLElement.prototype.scrollIntoView = jest.fn();
  apiFetch.mockImplementation(async (url, options) => {
    let data;
    if (url.endsWith('/capabilities')) data = { models, webSearch: true, maxOutputTokens: 1024 };
    else if (url.endsWith('/history')) data = [];
    else if (url.endsWith('/new')) data = current;
    else if (url.endsWith('/message')) data = reply;
    else throw new Error(`Unexpected request: ${url}`);
    return { ok: true, json: async () => data };
  });
});

test('one submission sends the selected models together and displays successful and failed candidates', async () => {
  render(<ModelTester session={session} />);
  await screen.findByText('GLM-5.3-Flash');
  fireEvent.change(screen.getByLabelText('Question for the selected models'), { target: { value: 'What does Shane say?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Compare 3 models' }));
  const results = await screen.findByLabelText('Model responses');
  expect(within(results).getByRole('region', { name: 'Qwen3.8 Flash' })).toBeVisible();
  expect(within(results).getByRole('region', { name: 'gpt-oss-120B' })).toBeVisible();
  expect(within(results).getByRole('alert')).toHaveTextContent('HTTP 503');
  const calls = apiFetch.mock.calls.filter(([url]) => url.endsWith('/message'));
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0][1].body)).toEqual({ message: 'What does Shane say?', mode: 'archive', modelIds: models.map(model => model.id) });
  fireEvent.click(within(results).getAllByRole('button', { name: 'View passage [S1]' })[0]);
  expect(await screen.findByLabelText('Passage [S1]')).toHaveTextContent('A recorded spectrum passage.');
  expect(screen.getByRole('link', { name: 'Open on AEI' })).toHaveAttribute('href', source.url);
});

test('all three modes remain available and library search never submits a model request', async () => {
  render(<ModelTester session={session} />);
  await screen.findByText('GLM-5.3-Flash');
  fireEvent.click(screen.getByRole('button', { name: 'AEI Article Search' }));
  expect(screen.getByText('Shared library search results')).toBeVisible();
  expect(apiFetch.mock.calls.some(([url]) => url.endsWith('/message'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'AEI + Web' }));
  fireEvent.change(screen.getByLabelText('Question for the selected models'), { target: { value: 'What changed?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Compare 3 models' }));
  await screen.findByLabelText('Model responses');
  expect(JSON.parse(apiFetch.mock.calls.find(([url]) => url.endsWith('/message'))[1].body).mode).toBe('web');
  expect(screen.queryByRole('button', { name: 'File Manager' })).not.toBeInTheDocument();
});

test('deselecting a model changes the server request and an empty selection cannot run', async () => {
  render(<ModelTester session={session} />);
  await screen.findByText('GLM-5.3-Flash');
  const choices = screen.getByRole('group', { name: 'Models to compare' });
  for (const checkbox of within(choices).getAllByRole('checkbox')) fireEvent.click(checkbox);
  fireEvent.change(screen.getByLabelText('Question for the selected models'), { target: { value: 'A question' } });
  expect(screen.getByRole('button', { name: 'Compare 0 models' })).toBeDisabled();
  fireEvent.click(within(choices).getAllByRole('checkbox')[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Compare 1 model' }));
  await waitFor(() => expect(apiFetch.mock.calls.some(([url]) => url.endsWith('/message'))).toBe(true));
  expect(JSON.parse(apiFetch.mock.calls.find(([url]) => url.endsWith('/message'))[1].body).modelIds).toEqual([models[0].id]);
});
