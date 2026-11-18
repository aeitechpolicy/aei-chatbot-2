import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { apiFetch, getSession, setSession } from './utils/api';

test('Compare Scholars has its own category and sends the selected pair through the app', async () => {
  const user = { id: 'owner', label: 'Chatbot Intern' };
  setSession({ token: 'comparison-test-session', user, expiresAt: Date.now() + 100000 });
  let chat = { id: 'comparison-chat', domainName: 'General', messages: [] };
  let submitted;
  fetch.mockImplementation(async (url, options = {}) => {
    if (url.endsWith('/api/auth/session')) return { ok: true, json: async () => ({ user }) };
    if (url.endsWith('/api/chat/new')) { expect(JSON.parse(options.body).domainName).toBe('General'); return { ok: true, json: async () => chat }; }
    if (url.endsWith('/api/chat/comparison-chat/message')) {
      submitted = JSON.parse(options.body);
      chat = { ...chat, messages: [{ role: 'assistant', content: 'A comparison.', comparison: [{ scholar: 'Clay Calvert', content: 'Limited evidence.', limited: true }, { scholar: 'Shane Tews', content: 'Limited evidence.', limited: true }] }] };
      return { ok: true, json: async () => ({ response: 'A comparison.', chat }) };
    }
    if (url.endsWith('/api/chat/comparison-chat')) return { ok: true, json: async () => chat };
    return { ok: true, json: async () => [] };
  });
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Compare Scholars', exact: true }));
  expect(screen.getByRole('heading', { name: 'Compare scholar perspectives' })).toBeVisible();
  const picker = within(screen.getByRole('group', { name: /Choose scholars to compare/ }));
  fireEvent.click(picker.getByRole('button', { name: 'Brent Orrell' }));
  fireEvent.click(picker.getByRole('button', { name: 'Will Rinehart' }));
  fireEvent.change(screen.getByLabelText('Ask about the scholars’ work'), { target: { value: 'Compare their approach to age verification.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => expect(submitted).toEqual({ message: 'Compare their approach to age verification.', mode: 'compare', comparisonScholars: ['Clay_Calvert', 'Shane_Tews'] }));
  expect(await screen.findByText('Comparing: Clay Calvert, Shane Tews')).toBeVisible();
});

test('a signed-in user can search saved articles without starting a chat or sending an AI message', async () => {
  fetch.mockImplementation(async url => {
    if (url.endsWith('/api/auth/login')) return { ok: true, json: async () => ({ token: 'search-test-session', user: { id: 'owner', label: 'Chatbot Intern' }, expiresAt: Date.now() + 10000 }) };
    if (url.endsWith('/api/files/domains')) return { ok: true, status: 200, json: async () => ({ Brent_Orrell: { name: 'Brent Orrell' } }) };
    if (url.endsWith('/api/chat/history')) return { ok: true, status: 200, json: async () => [] };
    if (url.endsWith('/api/research/status')) return { ok: true, json: async () => ({ lastSuccessfulRefresh: '2026-11-12', latestPublishedDate: '2026-11-10' }) };
    if (url.includes('/api/research/search?')) return { ok: true, status: 200, json: async () => ({ articles: [{ id: 'S1', title: 'Training article', author: 'Brent Orrell', date: '2026-11-10', excerpt: 'Training supports workers.', passageMatches: [[0, 8]], url: 'https://www.aei.org/article/' }], matchedCount: 1, mode: 'topic', coverage: { articles: 1 }, aiUsed: false }) };
    throw new Error(`Unexpected request: ${url}`);
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-only-search-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  fireEvent.click(await screen.findByRole('button', { name: 'AEI Article Search' }));
  expect(await screen.findByText('Nov 12, 2026')).toBeVisible();
  expect(screen.getByText('Library refreshed on')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Topic or research question'), { target: { value: 'training' } });
  fireEvent.input(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
  fireEvent.input(screen.getByLabelText('To'), { target: { value: '2026-11-12' } });
  fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'newest' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search saved articles' }));
  expect(await screen.findByRole('link', { name: 'Training article' })).toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => url.includes('sort=newest&from=2026-01-01&to=2026-11-12'))).toBe(true);
  expect(screen.getByText('Training', { selector: 'mark' })).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Training article for source list' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy source list' }));
  expect(await screen.findByLabelText('Selected sources')).toHaveValue('1. Training article\nBrent Orrell · 2026-11-10\nhttps://www.aei.org/article/');
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
    if (url.endsWith('/api/research/status')) return { ok: true, json: async () => ({ latestArticle: { title: 'Most recent test publication', date: '2026-11-10', url: 'https://www.aei.org/article/' } }) };
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
  expect(whatsNew.getByRole('heading', { name: 'Find articles and build a source list' })).toBeVisible();
  fireEvent.click(whatsNew.getByRole('button', { name: 'Start guided demo' }));
  const tour = within(await screen.findByRole('dialog', { name: 'Try AEI Chatbot' }));
  fireEvent.click(tour.getByRole('button', { name: 'AEI Article Search', exact: true }));
  fireEvent.change(tour.getByLabelText('Search the sample library'), { target: { value: 'Greg Oslan' } });
  fireEvent.click(tour.getByRole('button', { name: 'Search', exact: true }));
  expect(tour.getByRole('article', { name: 'Practice search result' })).toHaveTextContent('Why Is It So Hard to Stay Safe Online?');
  fireEvent.click(tour.getByRole('button', { name: 'Skip tour' }));
  expect(fetch.mock.calls.some(([url]) => /\/api\/chat\/new|\/message$/.test(url))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'How to use' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Try AEI Chatbot' })).getByRole('button', { name: 'Skip tour' }));
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
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask about the scholars’ work' }), { target: { value: 'Spectrum sharing' } });
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
  expect(await screen.findByText('Nov 10, 2026')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Most recent test publication' })).toBeVisible();
  expect(screen.queryByText('Library refreshed on')).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Newest first' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Will Rinehart' })).toHaveValue('Will_Rinehart');
  expect(screen.getByText('Brent Orrell · Clay Calvert · Shane Tews · Will Rinehart')).toBeVisible();
  expect(screen.queryByText(/Saved articles only|No AI credits/i)).not.toBeInTheDocument();
});


test.each(['demo1', 'demo2'])('the %s login always starts with What’s new then the tour and hides staff details', async account => {
  window.localStorage.setItem('aei-demo-release-guide-seen', '1');
  fetch.mockImplementation(async url => {
    if (url.endsWith('/api/auth/login')) return { ok: true, json: async () => ({ token: 'test-only-demo-session', user: { id: account, label: account === 'demo1' ? 'Demo User 1' : 'Demo User 2' }, expiresAt: Date.now() + 10000 }) };
    if (url.endsWith('/api/auth/logout')) return { ok: true, json: async () => ({ success: true }) };
    if (url.endsWith('/api/files/domains')) return { ok: true, json: async () => ({ Shane_Tews: { name: 'Shane Tews', file_count: 712 } }) };
    if (url.endsWith('/api/chat/history')) return { ok: true, json: async () => [] };
    if (url.endsWith('/api/research/status')) return { ok: true, json: async () => ({ latestArticle: { title: 'Latest example article', date: '2026-11-12', url: 'https://www.aei.org/example/' } }) };
    throw new Error('Unexpected demo request: ' + url);
  });
  render(<App />);
  for (let attempt = 0; attempt < 2; attempt++) {
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: account } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-only-demo-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const news = await screen.findByRole('dialog', { name: 'What’s new in the AEI Chatbot' });
    expect(within(news).getByRole('region', { name: 'Before and now interface comparison' })).toBeVisible();
    fireEvent.click(within(news).getByRole('button', { name: 'Continue to guided demo' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Try AEI Chatbot' })).getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('button', { name: 'Files', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usage and costs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Feedback inbox' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AEI Article Search', exact: true }));
    expect(await screen.findByRole('link', { name: 'Latest example article' })).toBeVisible();
    expect(screen.getByText('Nov 12, 2026')).toBeVisible();
    expect(screen.queryByText(/Library refreshed on|Last successful|712 files/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Sign in' });
  }
  expect(fetch.mock.calls.some(([url]) => /usage|feedback|chat\/new|message$/.test(url))).toBe(false);
});
