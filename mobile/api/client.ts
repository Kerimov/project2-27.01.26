import { Platform } from 'react-native';

/**
 * Для Android-эмулятора localhost на ПК доступен как 10.0.2.2
 * (иначе запросы уходят в "localhost" самого эмулятора).
 *
 * Для реального телефона задайте EXPO_PUBLIC_API_BASE_URL, например:
 * EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:3000
 */
function getDefaultBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv;

  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

export const API_BASE_URL = getDefaultBaseUrl();

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

type ApiError = Error & {
  status?: number;
  payload?: any;
};

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, clear: () => clearTimeout(timer) };
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 15000;
  const { controller, clear } = withTimeout(timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as any),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');

    if (!res.ok) {
      const err: ApiError = new Error(
        (payload && (payload.error || payload.message)) || `HTTP ${res.status}`
      );
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    return payload as T;
  } finally {
    clear();
  }
}

