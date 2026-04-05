import { NextRequest, NextResponse } from 'next/server';

const TIMEOUT_MS = 20000;

/**
 * Validate that a URL is safe to proxy (not a private/internal address).
 * This prevents SSRF attacks by blocking requests to private IP ranges.
 */
function isUrlSafeToProxy(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  // Only allow HTTPS (and HTTP for dev/LAN scenarios where proxy is explicitly used)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return false;
  }

  // Block private IPv4 ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, firstOctet, secondOctet] = ipv4Match.map(Number);
    if (
      firstOctet === 10 || // 10.x.x.x
      (firstOctet === 172 && secondOctet !== undefined && secondOctet >= 16 && secondOctet <= 31) || // 172.16.x.x – 172.31.x.x
      (firstOctet === 192 && secondOctet === 168) || // 192.168.x.x
      (firstOctet === 169 && secondOctet === 254) // 169.254.x.x link-local
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Grimmory proxy route - forwards requests to a Grimmory/Booklore server.
 * Supports two modes:
 * - POST: JSON body with { serverUrl, endpoint, method, headers, body } for API calls
 * - GET: Query params with { serverUrl, endpoint, method, auth } for media (images)
 */
async function forwardRequest(
  serverUrl: string,
  endpoint: string,
  method: string,
  extraHeaders: Record<string, string>,
  body: unknown,
): Promise<Response> {
  const targetUrl = `${serverUrl.replace(/\/$/, '')}${endpoint}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...extraHeaders,
    });

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(body);
    }

    return await fetch(targetUrl, fetchOptions);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * POST handler - used for JSON API calls
 */
export async function POST(request: NextRequest) {
  let payload: {
    serverUrl: string;
    endpoint: string;
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { serverUrl, endpoint, method = 'GET', headers = {}, body } = payload;

  if (!serverUrl || !endpoint) {
    return NextResponse.json({ error: 'Missing serverUrl or endpoint' }, { status: 400 });
  }

  try {
    new URL(serverUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid serverUrl' }, { status: 400 });
  }

  if (!isUrlSafeToProxy(serverUrl)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
  }

  // Strip sensitive fields from forwarded headers to prevent header injection
  const safeHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lkey = key.toLowerCase();
    if (lkey !== 'host' && lkey !== 'cookie') {
      safeHeaders[key] = value;
    }
  }

  try {
    console.log(`[Grimmory Proxy] ${method} ${endpoint}`);
    const response = await forwardRequest(serverUrl, endpoint, method, safeHeaders, body);
    const data = await response.text();

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = data;
    }

    if (typeof parsedData === 'string') {
      return new NextResponse(parsedData, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'text/plain',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return NextResponse.json(parsedData, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Grimmory Proxy] Error:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Proxy error' },
      { status: 502 },
    );
  }
}

/**
 * GET handler - used for media requests (images)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const serverUrl = searchParams.get('serverUrl');
  const endpoint = searchParams.get('endpoint');
  const auth = searchParams.get('auth');

  if (!serverUrl || !endpoint) {
    return NextResponse.json({ error: 'Missing serverUrl or endpoint' }, { status: 400 });
  }

  try {
    new URL(serverUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid serverUrl' }, { status: 400 });
  }

  if (!isUrlSafeToProxy(serverUrl)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
  }

  const extraHeaders: Record<string, string> = {};
  if (auth) {
    extraHeaders['Authorization'] = auth;
  }

  try {
    console.log(`[Grimmory Proxy] GET media ${endpoint}`);
    const targetUrl = `${serverUrl.replace(/\/$/, '')}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(targetUrl, {
      headers: extraHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Grimmory Proxy] Media error:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 502 });
  }
}

export async function OPTIONS(_: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
