import type { APIRequestContext, Page } from '@playwright/test';

import type { E2EUser } from '../fixtures/users';
import { apiPost } from './api.helper';

interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export async function registerByApi(
  request: APIRequestContext,
  user: E2EUser
): Promise<AuthSession> {
  const { status, body } = await apiPost<AuthResponse | { message: string }>(request, '/auth/register', {
    email: user.email,
    password: user.password
  });

  if (status !== 201 && status !== 200) {
    throw new Error(`registerByApi failed: ${status} ${(body as { message?: string }).message ?? ''}`);
  }

  const payload = body as AuthResponse;
  return {
    accessToken: payload.accessToken,
    user: payload.user
  };
}

export async function loginByApi(request: APIRequestContext, user: E2EUser): Promise<AuthSession> {
  const { status, body } = await apiPost<AuthResponse | { message: string }>(request, '/auth/login', {
    email: user.email,
    password: user.password
  });

  if (status !== 201 && status !== 200) {
    throw new Error(`loginByApi failed: ${status} ${(body as { message?: string }).message ?? ''}`);
  }

  const payload = body as AuthResponse;
  return {
    accessToken: payload.accessToken,
    user: payload.user
  };
}

export async function ensureSession(
  request: APIRequestContext,
  user: E2EUser
): Promise<AuthSession> {
  try {
    return await registerByApi(request, user);
  } catch {
    return loginByApi(request, user);
  }
}

export async function injectAuthSession(page: Page, session: AuthSession): Promise<void> {
  await page.addInitScript((payload) => {
    localStorage.setItem(
      'lexigram-auth',
      JSON.stringify({
        state: {
          token: payload.accessToken,
          user: payload.user
        },
        version: 0
      })
    );
  }, session);
}

export async function clearAuthSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem('lexigram-auth');
  });
}
