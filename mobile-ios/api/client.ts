import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Базовый URL API:
 * - EXPO_PUBLIC_API_BASE_URL — явный override
 * - dev + Expo Go: IP Metro (debuggerHost), тот же что в QR
 * - Android-эмулятор: 10.0.2.2
 * - iOS Simulator: localhost
 */
function hostFromExpoDebugger(): string | null {
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  if (!debuggerHost) return null;
  const host = debuggerHost.split(':')[0]?.trim();
  return host || null;
}

function getDefaultBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // iOS Simulator / Android Emulator
  if (!Constants.isDevice) {
    if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  // Физическое устройство: IP Metro (тот же, что в QR Expo)
  const lanHost = hostFromExpoDebugger();
  if (lanHost && lanHost !== 'localhost' && lanHost !== '127.0.0.1') {
    return `http://${lanHost}:3000`;
  }

  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

export const API_BASE_URL = getDefaultBaseUrl();

function buildRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  // localtunnel показывает interstitial без этого заголовка
  if (API_BASE_URL.includes('loca.lt')) {
    headers['Bypass-Tunnel-Reminder'] = 'true';
  }
  return headers;
}

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

  const headers = buildRequestHeaders(init?.headers as Record<string, string> | undefined);
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Failed to fetch' || msg.includes('Network request failed')) {
      throw new Error(
        `Нет связи с API (${API_BASE_URL}). Запустите Next.js и туннель, перезагрузите Expo (клавиша r).`
      );
    }
    throw e;
  } finally {
    clear();
  }
}

