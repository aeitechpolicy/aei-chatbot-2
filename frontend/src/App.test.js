import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { apiFetch, getSession, setSession } from './utils/api';

test('a signed-in user can search saved articles without starting a chat or sending an AI message', async () => {
  fetch.mockImplementation(async url => {
    if (url.endsWith('/api/auth/login')) return { ok: true, json: async () => ({ token: 'search-test-session', user: { id: 'owner', label: 'Chatbot Intern' }, expiresAt: Date.now() + 10000 }) };
    if (url.endsWith('/api/files/domains')) return { ok: true, status: 200, json: async () => ({ Brent_Orrell: { name: 'Brent Orrell' } }) };
    if (url.endsWith('/api/chat/history')) return { ok: true, status: 200, json: async () => [] };
    if (url.includes('/api/research/search?')) return { ok: true, status: 200, json: async () => ({ articles: [{ id: 'S1', title: 'Training article', author: 'Brent Orrell', body: 'An archived passage.', url: 'https://www.aei.org/article/' }], matchedCount: 1, mode: 'topic', coverage: { articles: 1 }, aiUsed: false }) };
    throw new Error(`Unexpected request: ${url}`);
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-only-search-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  fireEvent.click(await screen.findByRole('button', { name: 'AEI Article Search' }));
  fireEvent.change(screen.getByLabelText('Topic or research question'), { target: { value: 'training' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search saved articles' }));
  expect(await screen.findByRole('link', { name: 'Training article' })).toBeInTheDocument();
  const chatMode = screen.getByRole('button', { name: 'Article Chat' });
  const searchMode = screen.getByRole('button', { name: 'AEI Article Search' });
  expect(searchMode).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(chatMode);
  expect(chatMode).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('link', { name: 'Training article' })).not.toBeInTheDocument();
  fireEvent.click(searchMode);
  expect(screen.getByLabelText('Topic or research question')).toHaveValue('training');
  expect(screen.getByRole('link', { name: 'Training article' })).toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => /\/api\/chat\/new|\/message$/.test(url))).toBe(false);
});

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

test('a demo login shows research and chat while hiding staff controls', async () => {
  window.localStorage.removeItem('aei-demo-release-guide-seen');
  let savedChat;
  fetch.mockImplementation(async (url, options) => {
    if (url.endsWith('/api/auth/login')) return { ok: true, json: async () => ({ token: 'demo-test-token', user: { id: 'demo', label: 'Demo User' }, expiresAt: Date.now() + 10000 }) };
    if (url.endsWith('/api/files/domains')) return { ok: true, status: 200, json: async () => ({ Will_Rinehart: { name: 'Will_Rinehart', file_count: 19 } }) };
    if (url.endsWith('/api/chat/history')) return { ok: true, status: 200, json: async () => [] };
    if (url.endsWith('/api/chat/new')) {
      savedChat = { id: 'named-chat', domainName: JSON.parse(options.body).domainName, messages: [] };
      return { ok: true, json: async () => savedChat };
    }
    if (url.endsWith('/api/chat/named-chat')) return { ok: true, json: async () => savedChat };
    if (url.endsWith('/api/chat/named-chat/message')) {
      savedChat = { ...savedChat, messages: [{ role: 'assistant', content: 'A cited answer [S1].' }] };
      return { ok: true, json: async () => ({ response: savedChat.messages[0].content, chat: savedChat }) };
    }
    throw new Error(`Unexpected URL ${url}`);
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'demo' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-only-demo-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  const whatsNew = within(await screen.findByRole('dialog', { name: 'What’s new in the AEI Chatbot' }));
  expect(whatsNew.getByRole('heading', { name: 'See the evidence behind an answer' })).toBeVisible();
  fireEvent.click(whatsNew.getByRole('button', { name: 'Start guided demo' }));
  const tour = within(await screen.findByRole('dialog', { name: 'How to use AEI Chatbot' }));
  for (let step = 0; step < 3; step++) {
    fireEvent.click(tour.getByRole('button', { name: 'Next' }));
  }
  fireEvent.click(tour.getByRole('button', { name: 'Try the example question' }));
  expect(screen.getByRole('textbox', { name: 'Ask about our scholars’ work' })).toHaveValue(
    'What tradeoffs do the scholars discuss around online age verification?'
  );
  expect(fetch.mock.calls.some(([url]) => /\/api\/chat\/new|\/message$/.test(url))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'How to use' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'How to use AEI Chatbot' })).getByRole('button', { name: 'Skip tour' }));
  expect(await screen.findByRole('button', { name: 'AEI Article Search' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chats' })).toBeInTheDocument();
  expect(screen.getByText('Ask about work in the AEI Scholar Library.')).toBeVisible();
  const general = screen.getByRole('button', { name: 'All 4 scholars' });
  expect(general).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Brent Orrell', 'Clay Calvert', 'Shane Tews', 'Will Rinehart']) {
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
  }
  fireEvent.click(screen.getByRole('button', { name: 'Shane Tews' }));
  expect(general).toHaveAttribute('aria-pressed', 'false');
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/api/chat/new'))).toBe(false);
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask about our scholars’ work' }), { target: { value: 'Spectrum sharing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(await screen.findByText('Scholar: Shane Tews')).toBeVisible();
  await waitFor(() => expect(screen.getByRole('button', { name: 'New Chat' })).toBeEnabled());
  expect(savedChat.domainName).toBe('Shane_Tews');
  fireEvent.click(screen.getByRole('button', { name: 'New Chat' }));
  expect(screen.getByRole('button', { name: 'All 4 scholars' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: 'Usage and costs' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Files' })).not.toBeInTheDocument();
  expect(screen.queryByText('19 files')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'AEI Article Search' }));
  expect(screen.getByRole('option', { name: 'Will Rinehart' })).toHaveValue('Will_Rinehart');
  expect(screen.getByText('Brent Orrell · Clay Calvert · Shane Tews · Will Rinehart')).toBeVisible();
  expect(screen.queryByText(/Saved articles only|No AI credits/i)).not.toBeInTheDocument();
});
