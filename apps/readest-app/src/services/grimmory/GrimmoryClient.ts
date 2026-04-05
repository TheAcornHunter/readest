import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getAPIBaseUrl, isTauriAppPlatform, isWebAppPlatform } from '@/services/environment';
import { isLanAddress } from '@/utils/network';
import type {
  GrimmoryServer,
  GrimmoryLoginResponse,
  GrimmoryVersionInfo,
  GrimmoryLibrary,
  GrimmoryBook,
  GrimmoryBookReview,
  GrimmoryReadProgressRequest,
} from '@/types/grimmory';

const GRIMMORY_PROXY_URL = `${getAPIBaseUrl()}/grimmory/proxy`;

export class GrimmoryClient {
  private serverUrl: string;
  private token: string | undefined;
  private isLanServer: boolean;

  constructor(server: GrimmoryServer) {
    this.serverUrl = server.url.replace(/\/$/, '');
    this.token = server.token;
    this.isLanServer = isLanAddress(this.serverUrl);
  }

  private needsProxy(): boolean {
    return isWebAppPlatform() && !this.isLanServer;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      useAuth?: boolean;
    } = {},
  ): Promise<T> {
    const { method = 'GET', body, useAuth = true } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (useAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const bodyStr = body ? JSON.stringify(body) : undefined;

    let response: Response;

    if (!this.needsProxy()) {
      const fetchFn = isTauriAppPlatform() ? tauriFetch : window.fetch;
      const directUrl = `${this.serverUrl}${endpoint}`;
      response = await fetchFn(directUrl, {
        method,
        headers,
        body: bodyStr,
        danger: {
          acceptInvalidCerts: true,
          acceptInvalidHostnames: true,
        },
      });
    } else {
      response = await fetch(GRIMMORY_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: this.serverUrl,
          endpoint,
          method,
          headers,
          body: body ?? null,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.message) errorMsg = errJson.message;
        else if (errJson.error) errorMsg = errJson.error;
      } catch {
        // ignore parse error
      }
      throw new Error(errorMsg);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Check if the server is reachable by hitting the healthcheck endpoint.
   * Returns true if ANY HTTP response is received (even 4xx/5xx), meaning the
   * server is up. Returns false only if a network-level error occurs.
   */
  async checkReachable(): Promise<boolean> {
    const endpoint = '/api/v1/healthcheck';
    const url = `${this.serverUrl}${endpoint}`;

    try {
      if (!this.needsProxy()) {
        const fetchFn = isTauriAppPlatform() ? tauriFetch : window.fetch;
        await fetchFn(url, {
          method: 'GET',
          danger: {
            acceptInvalidCerts: true,
            acceptInvalidHostnames: true,
          },
        });
      } else {
        await fetch(GRIMMORY_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverUrl: this.serverUrl,
            endpoint,
            method: 'GET',
            headers: {},
            body: null,
          }),
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check server version for compatibility
   */
  async getVersion(): Promise<GrimmoryVersionInfo> {
    return this.request<GrimmoryVersionInfo>('/api/v1/version', { useAuth: false });
  }

  /**
   * Login with username and password, returns JWT tokens
   */
  async login(username: string, password: string): Promise<GrimmoryLoginResponse> {
    return this.request<GrimmoryLoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      useAuth: false,
      body: { username, password },
    });
  }

  /**
   * Refresh JWT token using a refresh token
   */
  async refreshToken(refreshToken: string): Promise<GrimmoryLoginResponse> {
    return this.request<GrimmoryLoginResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      useAuth: false,
      body: { refreshToken },
    });
  }

  /**
   * Get all libraries accessible to the current user
   */
  async getLibraries(): Promise<GrimmoryLibrary[]> {
    return this.request<GrimmoryLibrary[]>('/api/v1/libraries');
  }

  /**
   * Get a specific library by ID
   */
  async getLibrary(libraryId: number): Promise<GrimmoryLibrary> {
    return this.request<GrimmoryLibrary>(`/api/v1/libraries/${libraryId}`);
  }

  /**
   * Get all books in a library
   */
  async getBooks(libraryId: number): Promise<GrimmoryBook[]> {
    return this.request<GrimmoryBook[]>(`/api/v1/libraries/${libraryId}/book`);
  }

  /**
   * Get a specific book from a library
   */
  async getBook(libraryId: number, bookId: number): Promise<GrimmoryBook> {
    return this.request<GrimmoryBook>(`/api/v1/libraries/${libraryId}/book/${bookId}`);
  }

  /**
   * Get reviews for a book
   */
  async getBookReviews(bookId: number): Promise<GrimmoryBookReview[]> {
    return this.request<GrimmoryBookReview[]>(`/api/v1/reviews/book/${bookId}`);
  }

  /**
   * Update reading progress for a book
   */
  async updateReadingProgress(
    bookId: number,
    fileId: number,
    positionData: string,
    positionHref: string,
    progressPercent: number,
  ): Promise<void> {
    const payload: GrimmoryReadProgressRequest = {
      bookId,
      fileProgress: {
        bookFileId: fileId,
        positionData,
        positionHref,
        progressPercent,
      },
    };
    await this.request<void>('/api/v1/books/progress', {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * Download a book file and return its content as a Blob.
   */
  async downloadBookFile(bookId: number): Promise<Blob> {
    const endpoint = `/api/v1/books/${bookId}/download`;

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!this.needsProxy()) {
      const fetchFn = isTauriAppPlatform() ? tauriFetch : window.fetch;
      const response = await fetchFn(`${this.serverUrl}${endpoint}`, {
        method: 'GET',
        headers,
        danger: {
          acceptInvalidCerts: true,
          acceptInvalidHostnames: true,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    }

    const params = new URLSearchParams({
      serverUrl: this.serverUrl,
      endpoint,
      method: 'GET',
      auth: this.token ? `Bearer ${this.token}` : '',
    });
    const response = await fetch(`${GRIMMORY_PROXY_URL}?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  }

  /**
   * Get the URL for a book's thumbnail image
   * When using proxy or web mode, returns a proxied URL; otherwise returns direct URL.
   */
  getThumbnailUrl(bookId: number): string {
    const endpoint = `/api/v1/media/book/${bookId}/thumbnail`;
    if (this.needsProxy()) {
      const params = new URLSearchParams({
        serverUrl: this.serverUrl,
        endpoint,
        method: 'GET',
        auth: this.token ? `Bearer ${this.token}` : '',
      });
      return `${GRIMMORY_PROXY_URL}?${params.toString()}`;
    }
    return `${this.serverUrl}${endpoint}`;
  }

  /**
   * Get the URL for a book's cover image
   */
  getCoverUrl(bookId: number): string {
    const endpoint = `/api/v1/media/book/${bookId}/cover`;
    if (this.needsProxy()) {
      const params = new URLSearchParams({
        serverUrl: this.serverUrl,
        endpoint,
        method: 'GET',
        auth: this.token ? `Bearer ${this.token}` : '',
      });
      return `${GRIMMORY_PROXY_URL}?${params.toString()}`;
    }
    return `${this.serverUrl}${endpoint}`;
  }

  /**
   * Get Authorization header value for direct image requests
   */
  getAuthHeader(): string {
    return this.token ? `Bearer ${this.token}` : '';
  }
}
