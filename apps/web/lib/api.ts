import { useAuthStore } from '../store/auth-store';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:4000/api';

const API_BASE_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : DEFAULT_API_BASE_URL;

interface RequestOptions extends RequestInit {
  auth?: boolean;
  timeoutMs?: number;
}

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(options.headers);
  const timeoutMs = options.timeoutMs ?? 6000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  headers.set('Content-Type', 'application/json');

  if (options.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal
    });

    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      throw new ApiError(payload?.message ?? '请求失败', response.status);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请稍后重试', 408);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
