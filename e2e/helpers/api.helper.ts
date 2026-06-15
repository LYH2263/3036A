import type { APIRequestContext } from '@playwright/test';

export const API_BASE_URL = 'http://127.0.0.1:4000/api';

export function createAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function apiGet<T>(
  request: APIRequestContext,
  path: string,
  token?: string
): Promise<{ status: number; body: T }> {
  const response = await request.get(`${API_BASE_URL}${path}`, {
    headers: createAuthHeaders(token)
  });
  const body = (await response.json()) as T;

  return {
    status: response.status(),
    body
  };
}

export async function apiPost<T>(
  request: APIRequestContext,
  path: string,
  payload: unknown,
  token?: string
): Promise<{ status: number; body: T }> {
  const response = await request.post(`${API_BASE_URL}${path}`, {
    headers: createAuthHeaders(token),
    data: payload
  });
  const body = (await response.json()) as T;

  return {
    status: response.status(),
    body
  };
}
