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
  it('sends only name, time and macros of each meal, never the photo thumbnail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ advice: '¡Vas bien!' }));
    const meals = [
      { id: 'm1', name: 'Pollo con arroz', time: '2026-10-19T13:00:00.000Z', macros, imageUrl: 'data:image/jpeg;base64,/9j/AAAA' },
    ];

    await expect(getPiveAdvice(macros, macros, undefined, meals, '13:30')).resolves.toBe('¡Vas bien!');

    const { url, headers, body } = lastRequest();
    expect(url).toMatch(/\/obtenerConsejoPive$/);
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(body.meals).toEqual([{ name: 'Pollo con arroz', time: '2026-10-19T13:00:00.000Z', macros }]);
    expect(JSON.stringify(body)).not.toContain('base64');
  });

  it('returns a friendly fallback when the function fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

    await expect(getPiveAdvice(macros, macros, undefined, [], '13:30')).resolves.toMatch(/Buen trabajo/);
  });
});

describe('analyzeFood', () => {
  it('sends a text-only description without image fields', async () => {
    const result = { name: 'Huevos revueltos', ingredients: [], macros };
    fetchMock.mockResolvedValue(jsonResponse(result));

    await expect(analyzeFood({ text: '2 huevos revueltos' })).resolves.toEqual(result);

    const { url, body } = lastRequest();
    expect(url).toMatch(/\/analizarImagenComida$/);
    expect(body).toEqual({ text: '2 huevos revueltos' });
  });

  it('throws with the server message when the request fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'Missing parameters' });

    await expect(analyzeFood({})).rejects.toThrow('Missing parameters');
  });
});
