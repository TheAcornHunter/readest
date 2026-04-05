import { describe, test, expect, vi, beforeEach } from 'vitest';
import { GrimmoryClient } from '@/services/grimmory/GrimmoryClient';
import type { GrimmoryServer } from '@/types/grimmory';

// Mock tauri plugin
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

// Mock environment utils
vi.mock('@/services/environment', () => ({
  isTauriAppPlatform: vi.fn(() => false),
  isWebAppPlatform: vi.fn(() => false),
  getAPIBaseUrl: vi.fn(() => 'http://localhost:3000/api'),
}));

vi.mock('@/utils/network', () => ({
  isLanAddress: vi.fn(() => false),
}));

type MockFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

const mockServer: GrimmoryServer = {
  id: 'test-server',
  name: 'Test Grimmory',
  url: 'https://grimmory.example.com',
  token: 'test-jwt-token',
  refreshToken: 'test-refresh-token',
};

describe('GrimmoryClient', () => {
  let client: GrimmoryClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    fetchMock = vi.fn<() => Promise<MockFetchResponse>>().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('{}'),
    });

    vi.stubGlobal('fetch', fetchMock);

    client = new GrimmoryClient(mockServer);
  });

  test('creates client with server config', () => {
    expect(client).toBeDefined();
  });

  test('getVersion makes unauthenticated GET request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ current: '1.0.0', latest: '1.0.0' }),
      text: () => Promise.resolve(''),
    });

    const version = await client.getVersion();
    expect(version).toEqual({ current: '1.0.0', latest: '1.0.0' });

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/api/v1/version');
    // Should NOT have Authorization header for version check
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers?.['Authorization']).toBeUndefined();
  });

  test('login sends username and password', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ accessToken: 'new-jwt', refreshToken: 'new-refresh' }),
      text: () => Promise.resolve(''),
    });

    const result = await client.login('user', 'pass');
    expect(result.accessToken).toBe('new-jwt');
    expect(result.refreshToken).toBe('new-refresh');

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/api/v1/auth/login');
    expect(call[1]?.method).toBe('POST');
    const body = JSON.parse(call[1]?.body as string);
    expect(body.username).toBe('user');
    expect(body.password).toBe('pass');
    // Should not include Authorization for login
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers?.['Authorization']).toBeUndefined();
  });

  test('getLibraries sends Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 1, name: 'My Library' }]),
      text: () => Promise.resolve(''),
    });

    const libraries = await client.getLibraries();
    expect(libraries).toHaveLength(1);
    expect(libraries[0]?.name).toBe('My Library');

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers?.['Authorization']).toBe('Bearer test-jwt-token');
  });

  test('getBooks fetches from correct endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 42, title: 'Test Book' }]),
      text: () => Promise.resolve(''),
    });

    const books = await client.getBooks(1);
    expect(books).toHaveLength(1);
    expect(books[0]?.id).toBe(42);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/api/v1/libraries/1/book');
  });

  test('getBookReviews fetches from correct endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 1, reviewerName: 'Alice', rating: 4.5 }]),
      text: () => Promise.resolve(''),
    });

    const reviews = await client.getBookReviews(42);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.reviewerName).toBe('Alice');

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/api/v1/reviews/book/42');
  });

  test('throws on HTTP error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
      text: () => Promise.resolve('{"message":"Unauthorized"}'),
    });

    await expect(client.getLibraries()).rejects.toThrow('Unauthorized');
  });

  test('getAuthHeader returns Bearer token', () => {
    expect(client.getAuthHeader()).toBe('Bearer test-jwt-token');
  });

  test('getAuthHeader returns empty string when no token', () => {
    const serverWithoutToken: GrimmoryServer = {
      id: 'no-token',
      name: 'No Token Server',
      url: 'https://example.com',
    };
    const clientWithoutToken = new GrimmoryClient(serverWithoutToken);
    expect(clientWithoutToken.getAuthHeader()).toBe('');
  });

  test('getThumbnailUrl returns correct URL in direct mode', () => {
    const url = client.getThumbnailUrl(42);
    expect(url).toContain('/api/v1/media/book/42/thumbnail');
  });

  test('getCoverUrl returns correct URL in direct mode', () => {
    const url = client.getCoverUrl(42);
    expect(url).toContain('/api/v1/media/book/42/cover');
  });

  test('refreshToken sends refreshToken in body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ accessToken: 'refreshed-jwt', refreshToken: 'new-refresh-token' }),
      text: () => Promise.resolve(''),
    });

    const result = await client.refreshToken('old-refresh');
    expect(result.accessToken).toBe('refreshed-jwt');

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/api/v1/auth/refresh');
    const body = JSON.parse(call[1]?.body as string);
    expect(body.refreshToken).toBe('old-refresh');
  });

  test('strips trailing slash from server URL', () => {
    const serverWithSlash: GrimmoryServer = {
      ...mockServer,
      url: 'https://grimmory.example.com/',
    };
    const c = new GrimmoryClient(serverWithSlash);
    const url = c.getThumbnailUrl(1);
    expect(url).not.toContain('//api');
  });

  test('request handles 204 No Content without throwing', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      text: () => Promise.resolve(''),
    });

    // updateReadingProgress returns 204 from POST /api/v1/books/progress
    await expect(
      client.updateReadingProgress(1, 2, 'cfi', '/chapter1.html', 0.5),
    ).resolves.toBeUndefined();

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/api/v1/books/progress');
    expect(call[1]?.method).toBe('POST');
    const body = JSON.parse(call[1]?.body as string);
    expect(body.bookId).toBe(1);
    expect(body.fileProgress.bookFileId).toBe(2);
    expect(body.fileProgress.progressPercent).toBe(0.5);
  });

  test('checkReachable returns true on any HTTP response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    });

    const reachable = await client.checkReachable();
    expect(reachable).toBe(true);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/api/v1/healthcheck');
  });

  test('checkReachable returns false on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const reachable = await client.checkReachable();
    expect(reachable).toBe(false);
  });

  test('getBookReviews handles 204 No Content (no reviews)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      text: () => Promise.resolve(''),
    });

    const reviews = await client.getBookReviews(99);
    expect(reviews).toBeUndefined();
  });
});
