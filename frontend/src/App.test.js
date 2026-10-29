import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { apiFetch, getSession, setSession } from './utils/api';

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = jest.fn();
  global.Headers = class {
    constructor(values = {}) { this.values = { ...values }; }
    set(key, value) { this.values[key] = value; }
    get(key) { return this.values[key]; }
  };
});
beforeEach(() => { setSession(null); global.fetch = jest.fn(); });
afterEach(() => { setSession(null); jest.restoreAllMocks(); });

test('signed-out visitors see the login and do not request chat data', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'AEI Chatbot' })).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test('a rejected login displays the server message and keeps the user signed out', async () => {
  fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'The account or password was not recognized.' }) });
  render(<App />);
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'incorrect' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('not recognized');
  expect(getSession()).toBeNull();
  expect(screen.getByLabelText('Password')).toHaveValue('');
});

test('authenticated requests carry the session and a 401 clears it', async () => {
  setSession({ token: 'test-session-token', user: { id: 'owner' }, expiresAt: Date.now() + 10000 });
  fetch.mockResolvedValue({ status: 200 });
  await apiFetch('/api/usage');
  expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-session-token');
  fetch.mockResolvedValue({ status: 401 });
  await apiFetch('/api/usage');
  expect(getSession()).toBeNull();
});

test('a supervisor can sign in and reach the usage report', async () => {
  fetch.mockImplementation(async url => {
    if (url.endsWith('/api/auth/login')) return { ok: true, json: async () => ({ token: 'supervisor-test-token', user: { id: 'supervisor', label: 'Chatbot RA' }, expiresAt: Date.now() + 10000 }) };
    if (url.endsWith('/api/files/domains')) return { ok: true, status: 200, json: async () => ({}) };
    if (url.endsWith('/api/chat/history')) return { ok: true, status: 200, json: async () => [] };
    if (url.endsWith('/api/usage')) return { ok: true, status: 200, json: async () => ({ rows: [], settings: { dailyQuestions: 50, personQuestions: 30, dailyBudget: 0.5, storageConfigured: true, priceSource: 'Test estimate' } }) };
    throw new Error(`Unexpected URL ${url}`);
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'supervisor' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-only-ra-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Usage and costs' }));
  expect(await screen.findByText('No requests recorded yet.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
  await waitFor(() => expect(getSession().user.id).toBe('supervisor'));
  expect(window.sessionStorage.getItem('aei-private-session')).not.toContain('test-only-ra-password');
});
