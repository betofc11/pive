import { analyzeFood, getPiveAdvice } from './geminiService';

jest.mock('../firebase', () => ({
  auth: { currentUser: { getIdToken: jest.fn().mockResolvedValue('test-token') } },
}));

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

afterEach(() => jest.restoreAllMocks());

const jsonResponse = (body: unknown) => ({
  ok: true,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: url as string, headers: init.headers, body: JSON.parse(init.body) };
};

const macros = { protein: 30, carbs: 45, fats: 12, calories: 420 };

describe('getPiveAdvice', () => {
  afterEach(() => jest.useRealTimers());

  it('sends only the local date and time: the server reads the day itself', async () => {
    // 23:30 in New York is already the next day in UTC
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date(2026, 10, 13, 23, 30));
    fetchMock.mockResolvedValue(jsonResponse({ advice: 'Cena ligera.', slot: 'dinner', proposal: null }));

    await expect(getPiveAdvice()).resolves.toEqual({ advice: 'Cena ligera.', slot: 'dinner', proposal: null });

    const { url, headers, body } = lastRequest();
    expect(url).toMatch(/\/obtenerConsejoPive$/);
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(body).toEqual({ localDate: '2026-11-13', localTime: '23:30' });
  });

  it('returns the proposal to log, and tolerates a server without slot or proposal', async () => {
    const proposal = { slot: 'lunch', name: 'Arroz con pollo', macros, ingredients: [] };
    fetchMock.mockResolvedValueOnce(jsonResponse({ advice: 'Haz tu opción 1.', slot: 'lunch', proposal }));
    await expect(getPiveAdvice(new Date(2026, 10, 13, 12, 5))).resolves.toEqual({ advice: 'Haz tu opción 1.', slot: 'lunch', proposal });
    expect(lastRequest().body.localTime).toBe('12:05');

    fetchMock.mockResolvedValueOnce(jsonResponse({ advice: 'Solo texto.' }));
    await expect(getPiveAdvice()).resolves.toEqual({ advice: 'Solo texto.', slot: null, proposal: null });
  });

  it('returns null when the function fails or gives no advice', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });
    await expect(getPiveAdvice()).resolves.toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse({ advice: '' }));
    await expect(getPiveAdvice()).resolves.toBeNull();
  });
});

describe('analyzeFood', () => {
  it('sends a text-only description without image fields', async () => {
    const result = { name: 'Huevos revueltos', ingredients: [], macros, assumptions: [], mentionedSlot: null };
    fetchMock.mockResolvedValue(jsonResponse(result));

    await expect(analyzeFood({ text: '2 huevos revueltos' })).resolves.toEqual(result);

    const { url, body } = lastRequest();
    expect(url).toMatch(/\/analizarImagenComida$/);
    expect(body).toEqual({ text: '2 huevos revueltos', localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it('throws with the server message when the request fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'Missing parameters' });

    await expect(analyzeFood({})).rejects.toThrow('Missing parameters');
  });
});
